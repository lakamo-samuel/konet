import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users, universities, campuses, studentVerifications } from "./core";

export const verificationChallenges = pgTable(
  "verification_challenges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    verificationId: uuid("verification_id")
      .references(() => studentVerifications.id)
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    universityId: uuid("university_id")
      .references(() => universities.id)
      .notNull(),
    campusId: uuid("campus_id")
      .references(() => campuses.id)
      .notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("verification_challenge_user_idx").on(t.userId, t.createdAt)],
);

export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    objectKey: text("object_key").notNull(),
    purpose: varchar("purpose", { length: 30 }).notNull(),
    contentType: varchar("content_type", { length: 100 }).notNull(),
    expectedBytes: integer("expected_bytes").notNull(),
    status: varchar("status", { length: 20 }).default("pending").notNull(),
    assetId: text("asset_id"),
    version: integer("version"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    retainUntil: timestamp("retain_until", { withTimezone: true }).notNull(),
    verificationId: uuid("verification_id").references(
      () => studentVerifications.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("upload_object_key_uq").on(t.objectKey),
    index("upload_owner_idx").on(t.userId),
  ],
);

export const verificationDecisions = pgTable(
  "verification_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    verificationId: uuid("verification_id")
      .references(() => studentVerifications.id)
      .notNull(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    decision: varchar("decision", { length: 40 }).notNull(),
    reason: text("reason").notNull(),
    source: varchar("source", { length: 30 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("verification_decision_uq").on(t.verificationId)],
);
