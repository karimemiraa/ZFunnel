#!/usr/bin/env bash
# Creates infra/deploy/.env for a domain, with freshly generated secrets.
# Usage: ./infra/deploy/setup-env.sh zf.zealmarketing.net you@example.com
# Never overwrites an existing .env (your secrets and database password live there).
set -euo pipefail
cd "$(dirname "$0")"

DOMAIN="${1:-}"
EMAIL="${2:-}"
if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ]; then
  echo "Usage: $0 <root-domain> <email-for-certificates>"
  echo "Example: $0 zf.zealmarketing.net admin@zealmarketing.net"
  exit 1
fi
if ! [[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]]; then
  echo "\"$DOMAIN\" doesn't look like a domain name (lowercase, no https://)."
  exit 1
fi
if [ -e .env ]; then
  echo "infra/deploy/.env already exists. Not touching it (it holds your secrets)."
  echo "Edit it by hand, or move it away first if you really want a fresh one."
  exit 1
fi
command -v openssl >/dev/null || { echo "openssl is required."; exit 1; }

# Hex secrets: safe inside URLs (the database password is part of DATABASE_URL).
secret() { openssl rand -hex 32; }
IP="$(curl -fsS -4 --max-time 5 https://api.ipify.org 2>/dev/null || true)"

umask 077
sed \
  -e "s|^ROOT_DOMAIN=.*|ROOT_DOMAIN=${DOMAIN}|" \
  -e "s|^ACME_EMAIL=.*|ACME_EMAIL=${EMAIL}|" \
  -e "s|^SERVER_IPV4=.*|SERVER_IPV4=${IP}|" \
  -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(secret)|" \
  -e "s|^ANALYTICS_SALT=.*|ANALYTICS_SALT=$(secret)|" \
  -e "s|^POSTGRES_SUPERUSER_PASSWORD=.*|POSTGRES_SUPERUSER_PASSWORD=$(secret)|" \
  -e "s|^POSTGRES_APP_PASSWORD=.*|POSTGRES_APP_PASSWORD=$(secret)|" \
  -e "s|^# SECRETS_KEY=.*|SECRETS_KEY=$(secret)|" \
  -e "s|^EMAIL_FROM=.*|EMAIL_FROM=hello@${DOMAIN}|" \
  -e "s|^PAYMENTS_TEST_MODE=.*|PAYMENTS_TEST_MODE=true|" \
  .env.production.example > .env
chmod 600 .env

cat <<MSG
Created infra/deploy/.env for ${DOMAIN} (only readable by you).
Server IPv4 detected: ${IP:-unknown, set SERVER_IPV4 by hand}

Point these DNS records at the server, then run: sudo ./infra/deploy/deploy.sh
  A  ${DOMAIN}          ${IP:-<server IP>}
  A  app.${DOMAIN}      ${IP:-<server IP>}
  A  *.${DOMAIN}        ${IP:-<server IP>}

Still to fill in later (optional): SMTP_URL + EMAIL_FROM (emails), Stripe keys (real payments),
ANTHROPIC_API_KEY (AI). PAYMENTS_TEST_MODE is on so you can try checkout without Stripe;
set it to false before taking real orders.
MSG
