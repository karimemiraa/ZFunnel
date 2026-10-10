CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"funnel_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"type" text NOT NULL,
	"visitor" text NOT NULL,
	"revenue" integer DEFAULT 0 NOT NULL,
	"currency" text,
	"props" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_funnel_time_idx" ON "events" USING btree ("workspace_id","funnel_id","created_at");--> statement-breakpoint
CREATE INDEX "events_step_type_idx" ON "events" USING btree ("step_id","type");