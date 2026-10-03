import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./core";
export const staffAuthenticators = pgTable("staff_authenticators", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  secretCiphertext: text("secret_ciphertext"),
  pendingCiphertext: text("pending_ciphertext"),
  pendingExpiresAt: timestamp("pending_expires_at", { withTimezone: true }),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  lastUsedStep: integer("last_used_step"),
  recoveryHashes: text("recovery_hashes").array().notNull().default([]),
  attempts: integer("attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});
