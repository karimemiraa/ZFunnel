ALTER TABLE "funnels" ADD COLUMN "share_token" text;--> statement-breakpoint
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_shareToken_unique" UNIQUE("share_token");