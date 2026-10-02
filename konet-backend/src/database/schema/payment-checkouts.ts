import {
  pgTable,
  timestamp,
  uuid,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { payments } from "./work";
export const paymentCheckouts = pgTable(
  "payment_checkouts",
  {
    paymentId: uuid("payment_id")
      .primaryKey()
      .references(() => payments.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(),
    checkoutUrl: text("checkout_url"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("checkout_reference_uq").on(t.reference)],
);
