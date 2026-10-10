CREATE TABLE "funnel_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"funnel_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"suggestions" jsonb NOT NULL,
	"days" integer NOT NULL,
	"visitors" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "funnel_insights" ADD CONSTRAINT "funnel_insights_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "funnel_insights" ADD CONSTRAINT "funnel_insights_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "funnel_insights_funnel_idx" ON "funnel_insights" USING btree ("funnel_id","created_at");