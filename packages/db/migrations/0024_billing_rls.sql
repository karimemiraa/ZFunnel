ALTER TABLE "org_billing" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "org_billing" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "org_billing_tenant" ON "org_billing"
  USING (app_is_system() OR organization_id = app_organization_id())
  WITH CHECK (app_is_system() OR organization_id = app_organization_id());
