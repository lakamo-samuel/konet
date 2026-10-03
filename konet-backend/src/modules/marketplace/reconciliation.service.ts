import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { DATABASE, Database } from "../../database/database.module";
import * as s from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import { ListQuery, ReconciliationInput } from "../contracts/contract.dto";
import { PaymentService } from "./payment.service";
import { SettlementService } from "./settlement.service";
import { lockStaffRoles } from "../administration/staff-role-policy";
const fields = {
  id: s.reconciliations.id,
  actorId: s.reconciliations.actorId,
  from: s.reconciliations.from,
  to: s.reconciliations.to,
  status: s.reconciliations.status,
  total: s.reconciliations.total,
  checked: s.reconciliations.checked,
  skipped: s.reconciliations.skipped,
  mismatchCount: s.reconciliations.mismatchCount,
  createdAt: s.reconciliations.createdAt,
  startedAt: s.reconciliations.startedAt,
  completedAt: s.reconciliations.completedAt,
};
@Injectable()
export class ReconciliationService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  private running = false;
  private logger = new Logger(ReconciliationService.name);
  constructor(
    @Inject(DATABASE) private db: Database,
    private config: ConfigService,
    private payments: PaymentService,
    private settlements: SettlementService,
  ) {}
  onModuleInit() {
    if (this.config.get("NODE_ENV") === "test") return;
    this.timer = setInterval(() => {
      void this.drain();
    }, 30_000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async queue(actorId: string, input: ReconciliationInput) {
    const from = new Date(input.from),
      to = new Date(input.to);
    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      from >= to ||
      to.getTime() - from.getTime() > 31 * 86400_000 ||
      to.getTime() > Date.now() + 60_000
    )
      throw new DomainError(
        "INVALID_RECONCILIATION_WINDOW",
        "Choose a past range of at most 31 days; the end must be after the start.",
        422,
      );
    return this.db.transaction(async (tx) => {
      await lockStaffRoles(tx);
      const [actor] = await tx
        .select({ id: s.users.id })
        .from(s.users)
        .innerJoin(s.userRoles, eq(s.userRoles.userId, s.users.id))
        .where(
          and(
            eq(s.users.id, actorId),
            eq(s.users.accountStatus, "active"),
            inArray(s.userRoles.role, ["admin", "finance"]),
          ),
        )
        .limit(1);
      if (!actor)
        throw new DomainError(
          "STAFF_PERMISSION_REQUIRED",
          "An active administrator or finance operator is required.",
          403,
        );
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('konet.reconciliations'))`,
      );
      const [active] = await tx
        .select(fields)
        .from(s.reconciliations)
        .where(inArray(s.reconciliations.status, ["queued", "running"]))
        .limit(1);
      if (active) {
        if (
          active.from.getTime() === from.getTime() &&
          active.to.getTime() === to.getTime()
        )
          return active;
        throw new DomainError(
          "RECONCILIATION_BUSY",
          "A reconciliation is already queued or running. Wait before starting a different range.",
          409,
        );
      }
      const items: Array<{ kind: string; resourceId: string }> = [];
      for (const [kind, table] of [
        ["payment", s.payments],
        ["payout", s.payouts],
        ["refund", s.refunds],
      ] as const) {
        const rows = await tx
          .select({ resourceId: table.id })
          .from(table)
          .where(and(gte(table.createdAt, from), lt(table.createdAt, to)))
          .orderBy(table.createdAt, table.id)
          .limit(1001);
        items.push(...rows.map((row) => ({ ...row, kind })));
        if (items.length > 1000)
          throw new DomainError(
            "RECONCILIATION_TOO_LARGE",
            "This range contains more than 1,000 financial records. Choose a shorter range.",
            422,
          );
      }
      const [run] = await tx
        .insert(s.reconciliations)
        .values({ actorId, from, to, total: items.length })
        .returning(fields);
      if (items.length)
        await tx
          .insert(s.reconciliationItems)
          .values(items.map((item) => ({ ...item, runId: run.id })));
      await tx
        .insert(s.auditEvents)
        .values({
          actorId,
          action: "reconciliation.queued",
          resourceType: "reconciliation",
          resourceId: run.id,
          details: {
            from: from.toISOString(),
            to: to.toISOString(),
            total: items.length,
          },
        });
      return run;
    });
  }
  async list(query: ListQuery) {
    if (
      query.status &&
      ![
        "queued",
        "running",
        "completed",
        "completed_with_errors",
        "failed",
      ].includes(query.status)
    )
      throw new DomainError(
        "INVALID_STATUS",
        "Choose a valid reconciliation status.",
        400,
      );
    return this.db
      .select(fields)
      .from(s.reconciliations)
      .where(
        query.status ? eq(s.reconciliations.status, query.status) : undefined,
      )
      .orderBy(desc(s.reconciliations.createdAt), desc(s.reconciliations.id))
      .limit(query.limit ?? 20)
      .offset(query.offset ?? 0);
  }
  async one(id: string) {
    const [run] = await this.db
      .select(fields)
      .from(s.reconciliations)
      .where(eq(s.reconciliations.id, id));
    if (!run)
      throw new DomainError(
        "RECONCILIATION_NOT_FOUND",
        "Reconciliation not found.",
        404,
      );
    const items = await this.db
      .select()
      .from(s.reconciliationItems)
      .where(eq(s.reconciliationItems.runId, id))
      .orderBy(s.reconciliationItems.kind, s.reconciliationItems.id)
      .limit(1000);
    return { ...run, items };
  }
  async drain() {
    if (this.running) return;
    this.running = true;
    try {
      await this.processBatch();
    } catch {
      this.logger.error(
        "Reconciliation worker could not complete a batch; durable records remain available for retry.",
      );
    } finally {
      this.running = false;
    }
  }
  async processBatch() {
    const token = randomUUID();
    const run = await this.db.transaction(async (tx) => {
      const [candidate] = await tx
        .select()
        .from(s.reconciliations)
        .where(
          and(
            inArray(s.reconciliations.status, ["queued", "running"]),
            or(
              isNull(s.reconciliations.leaseUntil),
              lt(s.reconciliations.leaseUntil, new Date()),
            ),
          ),
        )
        .orderBy(s.reconciliations.createdAt)
        .limit(1)
        .for("update", { skipLocked: true });
      if (!candidate) return null;
      const [claimed] = await tx
        .update(s.reconciliations)
        .set({
          status: "running",
          startedAt: candidate.startedAt ?? new Date(),
          leaseToken: token,
          leaseUntil: new Date(Date.now() + 120_000),
        })
        .where(eq(s.reconciliations.id, candidate.id))
        .returning();
      return claimed;
    });
    if (!run) return;
    for (let index = 0; index < 10; index++) {
      const [item] = await this.db
        .select()
        .from(s.reconciliationItems)
        .where(
          and(
            eq(s.reconciliationItems.runId, run.id),
            eq(s.reconciliationItems.outcome, "pending"),
          ),
        )
        .orderBy(s.reconciliationItems.id)
        .limit(1);
      if (!item) break;
      const renewed = await this.db
        .update(s.reconciliations)
        .set({ leaseUntil: new Date(Date.now() + 120_000) })
        .where(
          and(
            eq(s.reconciliations.id, run.id),
            eq(s.reconciliations.leaseToken, token),
          ),
        )
        .returning({ id: s.reconciliations.id });
      if (!renewed.length) return;
      let result: {
        outcome: "checked" | "skipped" | "error";
        beforeStatus?: string | null;
        afterStatus?: string | null;
        gatewayStatus?: string | null;
        errorCode?: string;
      };
      try {
        result =
          item.kind === "payment"
            ? await this.payments.reconcile(item.resourceId)
            : item.kind === "payout"
              ? await this.settlements.reconcilePayout(item.resourceId)
              : await this.settlements.reconcileRefund(item.resourceId);
      } catch (error) {
        result = {
          outcome: "error",
          errorCode:
            error instanceof DomainError ? error.code : "GATEWAY_UNAVAILABLE",
        };
      }
      await this.db.transaction(async (tx) => {
        const [owned] = await tx
          .select({ id: s.reconciliations.id })
          .from(s.reconciliations)
          .where(
            and(
              eq(s.reconciliations.id, run.id),
              eq(s.reconciliations.leaseToken, token),
            ),
          )
          .for("update");
        if (!owned) return;
        await tx
          .update(s.reconciliationItems)
          .set({ ...result, attemptedAt: new Date() })
          .where(
            and(
              eq(s.reconciliationItems.id, item.id),
              eq(s.reconciliationItems.outcome, "pending"),
            ),
          );
      });
    }
    await this.db.transaction(async (tx) => {
      const [owned] = await tx
        .select()
        .from(s.reconciliations)
        .where(
          and(
            eq(s.reconciliations.id, run.id),
            eq(s.reconciliations.leaseToken, token),
          ),
        )
        .for("update");
      if (!owned) return;
      const [counts] = await tx
        .select({
          checked: sql<number>`count(*) filter (where outcome='checked')::integer`,
          skipped: sql<number>`count(*) filter (where outcome='skipped')::integer`,
          errors: sql<number>`count(*) filter (where outcome='error')::integer`,
          pending: sql<number>`count(*) filter (where outcome='pending')::integer`,
        })
        .from(s.reconciliationItems)
        .where(eq(s.reconciliationItems.runId, run.id));
      const completed = counts.pending === 0;
      await tx
        .update(s.reconciliations)
        .set({
          checked: counts.checked,
          skipped: counts.skipped,
          mismatchCount: counts.errors,
          status: completed
            ? counts.errors
              ? "completed_with_errors"
              : "completed"
            : "running",
          completedAt: completed ? new Date() : null,
          leaseToken: null,
          leaseUntil: null,
        })
        .where(eq(s.reconciliations.id, run.id));
      if (completed)
        await tx
          .insert(s.auditEvents)
          .values({
            actorId: run.actorId,
            action: "reconciliation.completed",
            resourceType: "reconciliation",
            resourceId: run.id,
            details: {
              checked: counts.checked,
              skipped: counts.skipped,
              errors: counts.errors,
            },
          });
    });
  }
}
