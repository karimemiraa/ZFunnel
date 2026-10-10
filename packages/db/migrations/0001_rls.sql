-- Row-level security for tenant tables.
-- FORCE makes the policies apply to the table owner too, so the app role
-- (which owns the schema but is NOT a superuser) is always filtered.
-- Workspace-scoped tables also require the workspace to belong to the current
-- organization, so a mismatched workspace_id can never cross tenants.
-- Settings are transaction-local, set by withOrganization / withWorkspace / withSystem.

CREATE OR REPLACE FUNCTION app_is_system() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('app.system', true), '') = 'on' $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_organization_id() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.organization_id', true), '') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_workspace_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.workspace_id', true), '')::uuid $$;
--> statement-breakpoint
ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workspaces" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "workspaces_tenant" ON "workspaces"
  USING (app_is_system() OR organization_id = app_organization_id())
  WITH CHECK (app_is_system() OR organization_id = app_organization_id());
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_workspace_in_org() RETURNS boolean
  LANGUAGE sql STABLE AS $$
    SELECT EXISTS (SELECT 1 FROM workspaces w WHERE w.id = app_workspace_id() AND w.organization_id = app_organization_id())
  $$;
--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "audit_logs_tenant" ON "audit_logs"
  USING (app_is_system() OR (workspace_id = app_workspace_id() AND app_workspace_in_org()))
  WITH CHECK (app_is_system() OR (workspace_id = app_workspace_id() AND app_workspace_in_org()));
