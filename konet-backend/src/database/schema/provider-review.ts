import {
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  providerProfiles,
  providerVerifications,
  users,
  verificationStatus,
} from "./core";
import { uploads } from "./verification";
export const providerEvidenceSubmissions = pgTable(
  "provider_evidence_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    verificationId: uuid("verification_id")
      .references(() => providerVerifications.id)
      .notNull(),
    uploadId: uuid("upload_id")
      .references(() => uploads.id)
      .notNull(),
    revision: integer("revision").notNull(),
    status: verificationStatus("status").default("pending").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("provider_evidence_revision_uq").on(
      t.verificationId,
      t.revision,
    ),
    uniqueIndex("provider_evidence_upload_uq").on(t.uploadId),
  ],
);
export const providerReviewDecisions = pgTable(
  "provider_review_decisions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id").references(() => users.id, {
      onDelete: "set null",
    }),
    resourceType: varchar("resource_type", { length: 40 }).notNull(),
    resourceId: uuid("resource_id").notNull(),
    revision: integer("revision").notNull(),
    decision: varchar("decision", { length: 40 }).notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    uniqueIndex("provider_review_decision_uq").on(
      t.resourceType,
      t.resourceId,
      t.revision,
    ),
    index("provider_review_resource_idx").on(t.resourceId),
  ],
);
export const providerOnboardingSteps = pgTable(
  "provider_onboarding_steps",
  {
    providerId: uuid("provider_id")
      .references(() => providerProfiles.id, { onDelete: "cascade" })
      .notNull(),
    step: varchar("step", { length: 30 }).notNull(),
    values: jsonb("values").$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [primaryKey({ columns: [t.providerId, t.step] })],
);
