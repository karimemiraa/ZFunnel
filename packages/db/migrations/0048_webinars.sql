CREATE TABLE "webinar_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"webinar_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"session_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"attended_at" timestamp with time zone,
	"offer_clicked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webinar_registrations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "webinars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"video_url" text DEFAULT '' NOT NULL,
	"schedule" jsonb NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"duration_minutes" integer DEFAULT 60 NOT NULL,
	"replay_hours" integer DEFAULT 48 NOT NULL,
	"offer_label" text,
	"offer_url" text,
	"offer_at_minute" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_webinar_id_webinars_id_fk" FOREIGN KEY ("webinar_id") REFERENCES "public"."webinars"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webinars" ADD CONSTRAINT "webinars_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "webinar_registrations_once_uq" ON "webinar_registrations" USING btree ("webinar_id","contact_id","session_at");--> statement-breakpoint
CREATE INDEX "webinar_registrations_webinar_idx" ON "webinar_registrations" USING btree ("webinar_id","session_at");--> statement-breakpoint
CREATE UNIQUE INDEX "webinars_ws_slug_uq" ON "webinars" USING btree ("workspace_id","slug");