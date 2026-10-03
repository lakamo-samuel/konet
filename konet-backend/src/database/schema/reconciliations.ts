import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./core";
export const reconciliations = pgTable(
  "reconciliations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    from: timestamp("from_at", { withTimezone: true }).notNull(),
    to: timestamp("to_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("queued"),
    total: integer("total").notNull().default(0),
    checked: integer("checked").notNull().default(0),
    skipped: integer("skipped").notNull().default(0),
    mismatchCount: integer("mismatch_count").notNull().default(0),
    leaseToken: uuid("lease_token"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("one_active_reconciliation_uq")
      .on(sql`(1)`)
      .where(sql`${t.status} in ('queued','running')`),
  ],
);
export const reconciliationItems = pgTable(
  "reconciliation_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => reconciliations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    resourceId: uuid("resource_id").notNull(),
    outcome: text("outcome").notNull().default("pending"),
    beforeStatus: text("before_status"),
    afterStatus: text("after_status"),
    gatewayStatus: text("gateway_status"),
    errorCode: text("error_code"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("reconciliation_resource_uq").on(t.runId, t.kind, t.resourceId),
    index("reconciliation_pending_idx").on(t.runId, t.outcome),
  ],
);
