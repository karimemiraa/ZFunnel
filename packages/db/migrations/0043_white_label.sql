ALTER TABLE "workspaces" ADD COLUMN "logo_url" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "brand_color" text DEFAULT '#4f46e5' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "hide_badge" boolean DEFAULT false NOT NULL;