-- Platform tables (ADR-024). Not tenant data: no organization or workspace context may
-- write them. Only withSystem code (behind the platform admin guard) can.

-- Admin audit log: system only, for reads and writes.
ALTER TABLE "platform_audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "platform_audit_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "platform_audit_log_system" ON "platform_audit_log"
  USING (app_is_system())
  WITH CHECK (app_is_system());
--> statement-breakpoint
-- Suspensions: the dashboard reads the flag next to the (unscoped) membership lookup, so
-- reading is open, like the auth tables. Inserting, changing or lifting one is system only.
ALTER TABLE "organization_suspensions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "organization_suspensions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "organization_suspensions_read" ON "organization_suspensions" FOR SELECT
  USING (true);
--> statement-breakpoint
CREATE POLICY "organization_suspensions_insert" ON "organization_suspensions" FOR INSERT
  WITH CHECK (app_is_system());
--> statement-breakpoint
CREATE POLICY "organization_suspensions_update" ON "organization_suspensions" FOR UPDATE
  USING (app_is_system())
  WITH CHECK (app_is_system());
--> statement-breakpoint
CREATE POLICY "organization_suspensions_delete" ON "organization_suspensions" FOR DELETE
  USING (app_is_system());
