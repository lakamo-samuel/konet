import { and, eq, inArray, isNull, or } from "drizzle-orm";
import * as s from "../../database/schema";
import { DomainError } from "../../common/errors/domain.error";
import type { StaffTransaction as Tx } from "../administration/staff-role-policy";
export async function assertNoAccountObligations(tx: Tx, userId: string) {
  const [row] = await tx
    .select({ id: s.jobs.id })
    .from(s.jobs)
    .innerJoin(s.providerProfiles, eq(s.providerProfiles.id, s.jobs.providerId))
    .innerJoin(s.payments, eq(s.payments.jobId, s.jobs.id))
    .where(
      and(
        or(eq(s.jobs.clientId, userId), eq(s.providerProfiles.userId, userId)),
        or(
          inArray(s.jobs.status, [
            "awaiting_payment",
            "scheduled",
            "in_progress",
            "awaiting_client_confirmation",
            "disputed",
          ]),
          inArray(s.payments.status, [
            "processing",
            "funded",
            "held",
            "release_pending",
            "disputed",
          ]),
        ),
      ),
    )
    .limit(1);
  if (row)
    throw new DomainError(
      "ACCOUNT_OBLIGATIONS_PENDING",
      "Complete or resolve active jobs and outstanding payments before making this change.",
      409,
    );
}
export async function revokeAccountAccess(tx: Tx, userId: string) {
  const now = new Date();
  await tx
    .update(s.sessions)
    .set({ revokedAt: now })
    .where(eq(s.sessions.userId, userId));
  await tx
    .update(s.passwordResetTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(s.passwordResetTokens.userId, userId),
        isNull(s.passwordResetTokens.consumedAt),
      ),
    );
  await tx
    .update(s.emailChangeChallenges)
    .set({ consumedAt: now })
    .where(
      and(
        eq(s.emailChangeChallenges.userId, userId),
        isNull(s.emailChangeChallenges.consumedAt),
      ),
    );
  await tx
    .update(s.emailOutbox)
    .set({ status: "cancelled", payloadCiphertext: null, leaseUntil: null })
    .where(
      and(
        eq(s.emailOutbox.userId, userId),
        inArray(s.emailOutbox.status, ["pending", "sending"]),
      ),
    );
}
