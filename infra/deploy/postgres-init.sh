#!/bin/sh
# Runs once, on first start of an empty database volume.
# The app connects as a NON-superuser so row-level security is always enforced.
set -eu
psql -v ON_ERROR_STOP=1 --username postgres <<SQL
CREATE ROLE zfunnel_app LOGIN PASSWORD '${APP_DB_PASSWORD}' NOSUPERUSER NOBYPASSRLS;
CREATE DATABASE zfunnel OWNER zfunnel_app;
SQL
