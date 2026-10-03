CREATE TABLE "reconciliation_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"outcome" text DEFAULT 'pending' NOT NULL,
	"before_status" text,
	"after_status" text,
	"gateway_status" text,
	"error_code" text,
	"attempted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"from_at" timestamp with time zone NOT NULL,
	"to_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"checked" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	"mismatch_count" integer DEFAULT 0 NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "gateway_fee_minor" integer;--> statement-breakpoint
ALTER TABLE "payment_checkouts" ADD COLUMN "payer_email" text;--> statement-breakpoint
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_run_id_reconciliations_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."reconciliations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliations" ADD CONSTRAINT "reconciliations_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reconciliation_resource_uq" ON "reconciliation_items" USING btree ("run_id","kind","resource_id");--> statement-breakpoint
CREATE INDEX "reconciliation_pending_idx" ON "reconciliation_items" USING btree ("run_id","outcome");--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_reconciliation_uq" ON "reconciliations" USING btree ((1)) WHERE "reconciliations"."status" in ('queued','running');