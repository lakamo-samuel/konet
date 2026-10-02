import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { providerProfiles, users } from "./core";
import { jobs, payments } from "./work";
export const payoutAccounts = pgTable(
  "payout_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providerProfiles.id),
    bankCode: varchar("bank_code", { length: 12 }).notNull(),
    accountName: text("account_name").notNull(),
    accountNumberLast4: varchar("account_number_last4", {
      length: 4,
    }).notNull(),
    fingerprint: text("fingerprint").notNull(),
    recipientCode: text("recipient_code").notNull(),
    status: varchar("status", { length: 20 }).default("verified").notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("one_active_payout_account_uq")
      .on(t.providerId)
      .where(sql`${t.active}=true`),
  ],
);
export const payouts = pgTable(
  "payouts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    providerId: uuid("provider_id")
      .notNull()
      .references(() => providerProfiles.id),
    accountId: uuid("account_id").references(() => payoutAccounts.id),
    recipientCode: text("recipient_code"),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),
    reference: text("reference").notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    gatewayStatus: text("gateway_status"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("payout_job_uq").on(t.jobId),
    uniqueIndex("payout_payment_uq").on(t.paymentId),
    uniqueIndex("payout_reference_uq").on(t.reference),
    index("payout_status_idx").on(t.status),
  ],
);
export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    amountMinor: integer("amount_minor").notNull(),
    currency: varchar("currency", { length: 3 }).default("NGN").notNull(),
    reason: text("reason").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    gatewayId: text("gateway_id"),
    gatewayStatus: text("gateway_status"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("one_full_refund_uq").on(t.paymentId),
    uniqueIndex("refund_gateway_id_uq").on(t.gatewayId),
    index("refund_status_idx").on(t.status),
  ],
);
