#!/usr/bin/env bash
# Builds and (re)starts the ZFunnel stack. Safe to re-run; only touches the "zfunnel"
# compose project, its zfunnel_internal network and its own volumes.
set -euo pipefail
cd "$(dirname "$0")"
COMPOSE=(docker compose -f docker-compose.prod.yml --env-file .env)

[ -f .env ] || { echo "Missing infra/deploy/.env: copy .env.production.example and fill it in."; exit 1; }
# shellcheck disable=SC1091
set -a; . ./.env; set +a
for v in ROOT_DOMAIN ACME_EMAIL BETTER_AUTH_SECRET ANALYTICS_SALT POSTGRES_SUPERUSER_PASSWORD POSTGRES_APP_PASSWORD; do
  [ -n "${!v:-}" ] || { echo "Required setting $v is empty in infra/deploy/.env"; exit 1; }
done

# Refuse to grab ports another app is using, unless explicitly configured.
command -v ss >/dev/null || command -v netstat >/dev/null || { echo "Install iproute2 (ss) so ports can be checked safely."; exit 1; }
for p in "${CADDY_HTTP_PORT:-80}" "${CADDY_HTTPS_PORT:-443}"; do
  if (ss -ltn 2>/dev/null || netstat -ltn 2>/dev/null) | awk '{print $4}' | grep -qE "[:.]$p$"; then
    if ! docker ps --format '{{.Names}} {{.Ports}}' | grep -q "^zfunnel-caddy.*:$p->"; then
      echo "Port $p is in use by another program. Set CADDY_HTTP_PORT/CADDY_HTTPS_PORT in .env (see docs/DEPLOYMENT.md)."
      exit 1
    fi
  fi
done

echo "→ Building images (first build takes several minutes)…"
"${COMPOSE[@]}" build
echo "→ Starting stack (migrations run first)…"
"${COMPOSE[@]}" up -d --remove-orphans
echo "→ Status:"
"${COMPOSE[@]}" ps
echo
echo "Done. Dashboard: https://app.${ROOT_DOMAIN}  (certificates are issued on first visit)"
