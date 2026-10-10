# Deploying ZFunnel to your Oracle Cloud VPS

ZFunnel runs as one isolated Docker Compose project (`zfunnel`) on a private network (`zfunnel_internal`). It never touches other containers, networks or volumes on the server. The only shared resources are ports 80/443, and there is a mode for servers where another proxy already owns them.

## Your setup: zf.zealmarketing.net

| Setting                         | Value                                                         |
| ------------------------------- | ------------------------------------------------------------- |
| ROOT_DOMAIN                     | `zf.zealmarketing.net`                                        |
| Dashboard                       | `https://app.zf.zealmarketing.net`                            |
| Free workspace sites            | `https://<workspace>.zf.zealmarketing.net`                    |
| CNAME target for custom domains | `sites.zf.zealmarketing.net` (covered by the wildcard record) |

DNS records at the provider that hosts `zealmarketing.net`, all pointing to the VPS's public IPv4:

| Type | Name (host) | Value     |
| ---- | ----------- | --------- |
| A    | `zf`        | server IP |
| A    | `app.zf`    | server IP |
| A    | `*.zf`      | server IP |

Then follow steps 2–6 below. For Arabic, each workspace picks its site language under Settings → General. Each user picks their dashboard language from the account menu.

## 0. What you need

- The VPS with Docker + the Compose plugin (`docker compose version`).
- A domain for the platform, e.g. `zfunnel.yourbrand.com` (called **ROOT_DOMAIN** below).
- Optional for real payments: a Stripe account with **Connect** enabled.

## 1. DNS

At your DNS provider, point these to the server's public IPv4:

| Type | Name                | Value     | Used for                                |
| ---- | ------------------- | --------- | --------------------------------------- |
| A    | `ROOT_DOMAIN`       | server IP | redirects to the dashboard              |
| A    | `app.ROOT_DOMAIN`   | server IP | dashboard                               |
| A    | `*.ROOT_DOMAIN`     | server IP | free workspace subdomains               |
| A    | `sites.ROOT_DOMAIN` | server IP | CNAME target for customers' own domains |

## 2. Oracle Cloud firewall (two layers!)

1. **VCN security list** (Console → Networking → VCN → Security Lists): add ingress rules for TCP 80 and 443 from `0.0.0.0/0`.
2. **The VM's own iptables.** Oracle's Ubuntu images ship with REJECT rules:
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo netfilter-persistent save
   ```

## 3. Get the code onto the server

```bash
git clone https://github.com/karimemiraa/zfunnel.git ~/zfunnel   # private repo: use a GitHub deploy key or token
cd ~/zfunnel
```

## 4. Inspect first (read-only)

```bash
sudo ./infra/deploy/preflight.sh
```

This lists running containers, port usage, memory and architecture, and changes nothing. If ports 80/443 are taken, read **Sharing ports** below before continuing.

## 5. Configure

```bash
./infra/deploy/setup-env.sh zf.zealmarketing.net you@zealmarketing.net
```

This writes `infra/deploy/.env` with your domain, freshly generated secrets, and file permissions so only you can read it. It never overwrites an existing `.env`. To fill the file in by hand instead, copy `.env.production.example` and generate each secret with `openssl rand -hex 32`. Use hex, not base64: the database password is part of a URL, and base64 can contain `/` or `+`.

## 6. Deploy

```bash
sudo ./infra/deploy/deploy.sh
```

- The first build takes 5–15 minutes; Oracle Ampere (ARM) builds natively.
- Database migrations run automatically before the apps start.
- Then open `https://app.ROOT_DOMAIN`. The certificate is issued on first visit.

**Updates:** `git pull && sudo ./infra/deploy/deploy.sh`.

**Backups:** add `infra/deploy/backup.sh` to cron (the command is in the file's header). Backups are kept for 14 days in `/var/backups/zfunnel`.

## 7. Stripe (real payments)

1. In Stripe: **Connect → Get started**, choose "Platform". Use **test mode** first.
2. Put `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY` into `.env`.
3. Webhook (Developers → Webhooks → Add endpoint):
   - URL: `https://app.ROOT_DOMAIN/api/webhooks/stripe`
   - **Listen to: Events on Connected accounts**
   - Events: `account.updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `charge.refunded`
   - Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
4. A **second** webhook endpoint for ZFunnel's own subscriptions (plans your users pay you):
   - Same URL, **Listen to: Events on your account**
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy its signing secret into `STRIPE_PLATFORM_WEBHOOK_SECRET`.
5. Turn on the **Customer portal** (Settings → Billing → Customer portal) and allow switching between the ZFunnel plans, so users can upgrade, downgrade, cancel and update their card.
6. Run `deploy.sh` again. Each workspace then connects its own Stripe under **Settings → Payments**. Plan prices are created in Stripe automatically from `packages/shared/src/plans.ts`.

`PAYMENTS_TEST_MODE=true` enables a fake card gateway for workspaces without Stripe (ADR-011). Keep it `false` once you have real customers.

## 8. Email and AI

- **Email.** Set `SMTP_URL` and `EMAIL_FROM` in `.env.production`, using any SMTP provider (Postmark, Amazon SES, Mailgun, Brevo…). Verify the `EMAIL_FROM` domain with your provider (SPF and DKIM), then redeploy. Without SMTP, broadcasts, automation emails and customer sign-in links stay queued and fail.
- **AI copywriter (optional).** Set `ANTHROPIC_API_KEY`. Without it, the AI buttons explain that AI isn't set up.

## 9. Platform admin (`/admin`)

The super admin area lives at `https://app.ROOT_DOMAIN/admin` (ADR-024). Two things make someone an admin:

1. Their email is listed in `PLATFORM_ADMIN_EMAILS` in `infra/deploy/.env` (comma-separated, case doesn't matter). `setup-env.sh` puts the email you pass it there. For this deployment the owner sets:

   ```bash
   PLATFORM_ADMIN_EMAILS=karim@zealmarketing.net
   ```

2. Their email is **verified**. Sign-up doesn't send a verification email yet, so after signing up with that address, mark it verified once on the server:

   ```bash
   cd infra/deploy
   sudo docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres psql -U postgres -d zfunnel \
     -c "update \"user\" set email_verified = true where lower(email) = 'karim@zealmarketing.net';"
   ```

Then run `sudo ./infra/deploy/deploy.sh` (or restart the `web` container) so the new env is read. An **Admin** link appears in the account menu. To add another admin, append their email to the list, verify it the same way and redeploy; to remove one, take it out of the list and redeploy. Everyone else gets a 404 at `/admin`, and every admin action is recorded in **Admin → Audit log**.

## Sharing ports (another proxy already uses 80/443)

1. Set `CADDY_HTTP_PORT=8080` and `CADDY_HTTPS_PORT=8443` in `.env`, then deploy.
2. In the existing proxy, forward ZFunnel traffic to them:
   - **Platform hosts** (`app.`, `*.ROOT_DOMAIN`, `sites.`): pass TLS through to `127.0.0.1:8443`, e.g. nginx `stream { map $ssl_preread_server_name … }`. Then Caddy keeps handling certificates itself.
   - **Customers' custom domains** need the same TLS passthrough as a _default_ route, because their hostnames aren't known in advance. If the existing proxy can't do that, give ZFunnel a second public IP (Oracle allows secondary VNIC IPs) and bind Caddy to it.

## Troubleshooting

| Symptom                                  | Check                                                               |
| ---------------------------------------- | ------------------------------------------------------------------- |
| Browser can't connect                    | Both firewall layers (step 2); `sudo docker compose -p zfunnel ps`  |
| Certificate errors                       | DNS points at this server; `sudo docker logs zfunnel-caddy-1`       |
| Custom domain stuck on "Waiting for DNS" | Customer's CNAME → `sites.ROOT_DOMAIN` and TXT record; click Verify |
| 502 from Caddy                           | `sudo docker logs zfunnel-web-1` / `zfunnel-sites-1`                |
