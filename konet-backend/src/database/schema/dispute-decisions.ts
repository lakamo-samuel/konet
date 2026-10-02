import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { disputes } from "./work";
import { users } from "./core";
export const disputeDecisions = pgTable(
  "dispute_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    disputeId: uuid("dispute_id")
      .notNull()
      .references(() => disputes.id),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id),
    decision: varchar("decision", { length: 32 }).notNull(),
    reason: text("reason").notNull(),
    refundAmountMinor: integer("refund_amount_minor"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("dispute_decisions_dispute_unique").on(t.disputeId)],
);
