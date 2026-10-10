CREATE TABLE "org_billing" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_billing_stripeSubscriptionId_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "org_billing" ADD CONSTRAINT "org_billing_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;