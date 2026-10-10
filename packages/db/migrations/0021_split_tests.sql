CREATE TABLE "step_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"name" text DEFAULT 'B' NOT NULL,
	"draft" jsonb NOT NULL,
	"draft_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_version_id" uuid,
	"published_at" timestamp with time zone,
	"weight" integer DEFAULT 50 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "variant_id" uuid;--> statement-breakpoint
ALTER TABLE "step_variants" ADD CONSTRAINT "step_variants_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_variants" ADD CONSTRAINT "step_variants_step_id_funnel_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."funnel_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_variants" ADD CONSTRAINT "step_variants_published_version_id_page_versions_id_fk" FOREIGN KEY ("published_version_id") REFERENCES "public"."page_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "step_variants_step_idx" ON "step_variants" USING btree ("step_id");--> statement-breakpoint
CREATE INDEX "events_step_variant_idx" ON "events" USING btree ("step_id","variant_id","created_at");