CREATE TABLE "conversion_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"event" text NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"response_code" integer,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tracking_settings" (
	"workspace_id" uuid PRIMARY KEY NOT NULL,
	"meta_pixel_id" text,
	"meta_token_sealed" text,
	"meta_test_code" text,
	"tiktok_pixel_code" text,
	"tiktok_token_sealed" text,
	"tiktok_test_code" text,
	"ga4_measurement_id" text,
	"ga4_secret_sealed" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversion_deliveries" ADD CONSTRAINT "conversion_deliveries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_settings" ADD CONSTRAINT "tracking_settings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversion_deliveries_event_uq" ON "conversion_deliveries" USING btree ("platform","event_id");--> statement-breakpoint
CREATE INDEX "conversion_deliveries_ws_idx" ON "conversion_deliveries" USING btree ("workspace_id","created_at");