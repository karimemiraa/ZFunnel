-- The app connects as a NON-superuser role: superusers bypass row-level security,
-- which would silently disable tenant isolation.
CREATE ROLE zfunnel_app LOGIN PASSWORD 'zfunnel_app' NOSUPERUSER NOBYPASSRLS;
CREATE DATABASE zfunnel OWNER zfunnel_app;
CREATE DATABASE zfunnel_test OWNER zfunnel_app;
