CREATE TABLE "sms_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'twilio' NOT NULL,
	"account_sid" text NOT NULL,
	"auth_token_sealed" text NOT NULL,
	"from_number" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sms_settings" ADD CONSTRAINT "sms_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;