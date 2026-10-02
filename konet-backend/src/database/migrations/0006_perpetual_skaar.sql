CREATE TABLE "payment_checkouts" (
	"payment_id" uuid PRIMARY KEY NOT NULL,
	"reference" text NOT NULL,
	"checkout_url" text,
	"lease_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payment_checkouts" ADD CONSTRAINT "payment_checkouts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_reference_uq" ON "payment_checkouts" USING btree ("reference");