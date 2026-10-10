ALTER TABLE "orders" ADD COLUMN "shipping" jsonb;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "in_store" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "stock" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "requires_shipping" boolean DEFAULT false NOT NULL;