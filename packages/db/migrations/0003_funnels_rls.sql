-- Reusable helper: makes a table workspace-scoped (same rules as audit_logs, see 0001_rls.sql).
CREATE OR REPLACE FUNCTION app_enable_workspace_rls(tbl regclass) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', tbl);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', tbl);
  EXECUTE format(
    'CREATE POLICY %I ON %s USING (app_is_system() OR (workspace_id = app_workspace_id() AND app_workspace_in_org())) '
    'WITH CHECK (app_is_system() OR (workspace_id = app_workspace_id() AND app_workspace_in_org()))',
    tbl::text || '_tenant', tbl);
END $$;
--> statement-breakpoint
SELECT app_enable_workspace_rls('funnels');
--> statement-breakpoint
SELECT app_enable_workspace_rls('funnel_steps');
--> statement-breakpoint
SELECT app_enable_workspace_rls('page_versions');
