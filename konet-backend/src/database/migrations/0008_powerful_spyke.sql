CREATE TABLE "dispute_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dispute_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"decision" varchar(32) NOT NULL,
	"reason" text NOT NULL,
	"refund_amount_minor" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dispute_decisions" ADD CONSTRAINT "dispute_decisions_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_decisions" ADD CONSTRAINT "dispute_decisions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dispute_decisions_dispute_unique" ON "dispute_decisions" USING btree ("dispute_id");