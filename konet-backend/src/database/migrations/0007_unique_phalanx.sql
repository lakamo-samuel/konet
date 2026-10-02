CREATE TABLE "payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" uuid NOT NULL,
	"bank_code" varchar(12) NOT NULL,
	"account_name" text NOT NULL,
	"account_number_last4" varchar(4) NOT NULL,
	"fingerprint" text NOT NULL,
	"recipient_code" text NOT NULL,
	"status" varchar(20) DEFAULT 'verified' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider_id" uuid NOT NULL,
	"account_id" uuid,
	"recipient_code" text,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"reference" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"gateway_status" text,
	"attempted_at" timestamp with time zone,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'NGN' NOT NULL,
	"reason" text NOT NULL,
	"actor_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"gateway_id" text,
	"gateway_status" text,
	"attempted_at" timestamp with time zone,
	"lease_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payout_accounts" ADD CONSTRAINT "payout_accounts_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_provider_id_provider_profiles_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_account_id_payout_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."payout_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_active_payout_account_uq" ON "payout_accounts" USING btree ("provider_id") WHERE "payout_accounts"."active"=true;--> statement-breakpoint
CREATE UNIQUE INDEX "payout_job_uq" ON "payouts" USING btree ("job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_payment_uq" ON "payouts" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payout_reference_uq" ON "payouts" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "payout_status_idx" ON "payouts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "one_full_refund_uq" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refund_gateway_id_uq" ON "refunds" USING btree ("gateway_id");--> statement-breakpoint
CREATE INDEX "refund_status_idx" ON "refunds" USING btree ("status");