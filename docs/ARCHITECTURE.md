# ZFunnel — Architecture & Project Structure

> Status: **DRAFT — proposal for sign-off.** Choices marked ❓ depend on open questions in `PRD.md` §9.

## 1. High-level system

```
                    ┌──────────────────────────────┐
  Builders ───────▶ │ apps/web  (app.zfunnel.app)  │  Next.js dashboard + editor
  (our users)       │  editor · CRM · email · ...  │──┐
                    └──────────────┬───────────────┘  │ enqueue jobs
                                   │ publish (JSON→    ▼
                                   │ cache purge)  ┌────────────┐
                                   ▼               │ apps/worker│ BullMQ consumers:
  Visitors ───▶ CDN/Edge ───▶ ┌──────────────┐     │ email,     │ workflows, webhooks,
  (their        (custom       │ apps/sites   │     │ analytics  │ analytics rollups,
  customers)    domains,      │ public       │     └─────┬──────┘ domain/TLS checks
                on-demand     │ renderer     │           │
                TLS)          └──────┬───────┘           │
                                     │ events, checkout  │
                                     ▼                   ▼
                    ┌───────────────────────────────────────────┐
                    │ PostgreSQL (RLS by workspace_id) · Redis  │
                    │ Object storage (S3/R2) · ClickHouse later │
                    └───────────────────────────────────────────┘
                         ▲            ▲              ▲
                       Stripe     SES/Resend      Claude API
                     (Connect)    (email send)    (AI SDK)
```

**Why the public renderer (`apps/sites`) is a separate app:**
- Published pages must stay fast and online even when the dashboard is deploying or broken.
- They ship **zero editor JavaScript**.
- Pages are rendered from published JSON snapshots and cached at the edge (ISR, invalidated on publish).

## 2. Key technical decisions

| Area | Decision | Notes |
|---|---|---|
| Language | TypeScript everywhere | One stack, shared types and zod schemas |
| Monorepo | pnpm workspaces + Turborepo | Fast cached builds |
| Framework | Next.js (App Router) for `web` and `sites` | `web` is seeded from nextjs/saas-starter |
| DB | PostgreSQL + Drizzle ORM | Row-level security on every tenant table; migrations in `packages/db` |
| Cache/queue | Redis + BullMQ | Workflow "wait 2 days" steps become delayed jobs; durable run state lives in Postgres |
| Auth | Better Auth + organization plugin | Org → workspaces → members with roles (owner, admin, editor, viewer). Customer-center logins are a separate auth realm per workspace. |
| Editor | Puck + Tiptap | Blocks live in `packages/blocks` and are shared by editor and renderer |
| Canvases | React Flow (xyflow) | Used for both the funnel map and the automation builder |
| Payments | Stripe **Connect** (each user connects their own Stripe account) | One-click upsell: first charge uses `setup_future_usage=off_session`, upsells are off-session PaymentIntents. PayPal follows via an adapter. |
| Email | react-email/MJML render → sender adapter (SES / Resend / SMTP / Postal) ❓ | Per-workspace sending domains (SPF/DKIM/DMARC wizard) |
| Analytics | Our own tracker (Umami-derived) → Postgres `events` table, partitioned monthly | Move to ClickHouse when volume requires it |
| A/B tests | Variant assigned at the edge by hashing the visitor ID (sticky cookie) | Bayesian significance in `packages/analytics` |
| Files/media | S3-compatible storage (Cloudflare R2 / MinIO locally) + image CDN | Video via Mux or Bunny Stream (Phase 3) ❓ |
| Domains | Free subdomain `{slug}.zfunnel.app`; custom domains via **Caddy on-demand TLS** (self-host) or **Vercel Domains API** (Vercel) ❓ | Middleware maps `Host` header → workspace → site/funnel |
| AI | Vercel AI SDK with Claude models | Prompt → funnel JSON (validated against block schemas) |
| Validation | zod schemas shared across client, server and API | |
| API | Internal: server actions + tRPC-style routers. Public: REST `/api/v1` with OpenAPI spec + webhooks (Phase 3). | |
| Testing | Vitest (unit), Playwright (e2e: build funnel → buy → upsell) | |
| i18n | next-intl, with RTL-ready layout ❓ | |

## 3. Project structure

```
zfunnel/
├── apps/
│   ├── web/                    # Dashboard + editor (app.zfunnel.app)
│   │   ├── app/
│   │   │   ├── (auth)/         # sign-in, sign-up, invite
│   │   │   ├── (dashboard)/[workspace]/
│   │   │   │   ├── funnels/    # list, funnel map (xyflow), step settings
│   │   │   │   ├── editor/     # Puck editor for a page
│   │   │   │   ├── sites/      # websites, blog            (Phase 3)
│   │   │   │   ├── products/   # products, prices, bumps, upsells
│   │   │   │   ├── orders/     # orders, refunds, subscriptions
│   │   │   │   ├── contacts/   # CRM contacts, tags, segments (Phase 2)
│   │   │   │   ├── pipelines/  # kanban opportunities      (Phase 2)
│   │   │   │   ├── email/      # broadcasts, sequences, templates (Phase 2)
│   │   │   │   ├── automations/# workflow builder (xyflow)  (Phase 2)
│   │   │   │   ├── courses/    # courses, lessons, members  (Phase 3)
│   │   │   │   ├── calendars/  # booking pages              (Phase 3)
│   │   │   │   ├── community/  #                            (Phase 4)
│   │   │   │   ├── affiliates/ #                            (Phase 4)
│   │   │   │   ├── analytics/  # funnel stats, A/B results
│   │   │   │   └── settings/   # domains, payments, team, billing, API keys
│   │   │   └── api/            # internal routes, Stripe/webhook receivers
│   │   └── components/
│   ├── sites/                  # Public renderer for subdomains + custom domains
│   │   ├── middleware.ts       # Host → workspace/site/funnel resolution, A/B assignment
│   │   └── app/
│   │       ├── [[...path]]/    # renders published page JSON with packages/blocks
│   │       ├── checkout/       # checkout session + upsell accept/decline endpoints
│   │       ├── members/        # customer center & course player (Phase 2–3)
│   │       └── t/              # analytics beacon endpoint
│   └── worker/                 # Node process: BullMQ queues
│       └── src/queues/         # email-send, workflow-step, webhook-out,
│                               # analytics-rollup, domain-verify, ai-generate
├── packages/
│   ├── db/                     # Drizzle schema, migrations, RLS policies, seed data
│   ├── auth/                   # Better Auth config: orgs, roles, customer realm
│   ├── ui/                     # shadcn/ui components, design tokens, icons
│   ├── blocks/                 # Funnel elements: render components + Puck field config
│   │                           # (section, row, column, headline, text, image, video,
│   │                           #  button, form, countdown, order-form, bump, upsell,
│   │                           #  pricing, testimonial, FAQ, progress bar, survey…)
│   ├── editor/                 # Puck setup, Tiptap inline text, breakpoints,
│   │                           # global styles, saved blocks, undo/history
│   ├── funnels/                # Funnel graph model, step types, routing rules,
│   │                           # funnel session state machine
│   ├── payments/               # Gateway interface + stripe/ (Connect, PaymentIntents,
│   │                           # off-session upsells, subscriptions) + paypal/
│   ├── email/                  # react-email/MJML templates, sender adapters,
│   │                           # suppression list, bounce/complaint handling
│   ├── automations/            # Workflow JSON schema, triggers, actions, executor
│   ├── analytics/              # Tracker script, ingestion, funnel queries, A/B stats
│   ├── domains/                # DNS verification, TLS provisioning adapters
│   ├── ai/                     # AI SDK wrappers, prompts, funnel-JSON generator
│   ├── templates/              # Starter funnels & pages as JSON
│   ├── shared/                 # zod schemas, types, money/date utils, errors
│   └── config/                 # tsconfig, eslint, tailwind presets
├── infra/
│   ├── docker/                 # docker-compose: postgres, redis, mailpit, minio
│   ├── caddy/                  # Caddyfile with on-demand TLS + ask endpoint ❓
│   └── deploy/                 # Vercel / Fly / Hetzner configs ❓
├── e2e/                        # Playwright end-to-end tests
├── docs/                       # PRD, ARCHITECTURE, REPO_RESEARCH, ROADMAP, DECISIONS
├── .github/workflows/          # lint, typecheck, test, license-check, e2e
├── THIRD_PARTY_NOTICES.md
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

## 4. Core data model (Phase 1–2)

```
Organization 1─* Workspace 1─* Member(user, role)
Workspace 1─* Domain(hostname, status, verified_at)
Workspace 1─* Site 1─* Page
Workspace 1─* Funnel 1─* FunnelStep(type: optin|sales|checkout|upsell|downsell|thankyou|webinar|survey,
                                    order, next_on_accept, next_on_decline)
FunnelStep 1─* PageVariant(page_id, weight)        # A/B split
Page 1─* PageVersion(puck_json, published_at)      # immutable snapshots; Page.published_version_id
Workspace 1─* Product 1─* Price(type: one_time|recurring|payment_plan, amount, currency, interval, trial_days)
FunnelStep *─* Offer(product/price, role: main|bump|upsell|downsell)
Workspace 1─* Contact(email, name, phone, custom_fields jsonb) *─* Tag
Contact 1─* Order 1─* OrderItem ; Order 1─* Payment ; Contact 1─* Subscription
Contact 1─* CustomerPaymentMethod(gateway, external_id)   # for one-click upsells
FunnelSession(visitor_id, contact_id, funnel_id, current_step, cart, utm)  # checkout state machine
Event(workspace_id, visitor_id, session_id, type, funnel_step_id, variant_id, revenue, props, ts)
Workflow 1─* WorkflowVersion(graph_json) ; WorkflowRun 1─* WorkflowStepRun
EmailTemplate, Broadcast, Sequence, EmailMessage(status, opens, clicks)
Pipeline 1─* Stage 1─* Opportunity(contact_id, value)
AuditLog(actor, action, entity, diff, ts)
```

Every tenant table has `workspace_id` with a Postgres RLS policy. The app connects as a role that sets `app.workspace_id` per request.

## 5. One-click upsell flow (the core money path)

1. A visitor on the checkout step submits the Stripe Payment Element. The PaymentIntent is created on the **user's connected Stripe account** with `setup_future_usage: off_session` and a Stripe Customer, and includes any order bump.
2. On success, the `FunnelSession` stores `customer_id` + `payment_method_id`, and the visitor is redirected to the next step (`next_on_accept`).
3. The upsell page has a "Yes, add to my order" button. It POSTs to `sites/checkout/upsell/accept`, which creates an **off-session PaymentIntent** (`confirm: true`, `off_session: true`).
   - If the bank requires SCA, we fall back to an on-session 3-D Secure confirmation.
4. Decline goes to `next_on_decline` (downsell or thank-you).
5. Every step emits analytics events. `order.paid` triggers workflows (email receipt, course access, tag, CRM opportunity).

## 6. Security & compliance

- RLS on all tenant data. Signed, short-lived publish tokens. CSRF protection on checkout endpoints.
- Custom code blocks run only on published pages, never inside the dashboard origin. Published sites live on separate domains from `app.`, which isolates cookies.
- Card data never touches our servers (SAQ-A).
- Outbound webhooks are signed with HMAC.
- GDPR: consent records, contact export/delete, EU hosting option ❓, DPA template.
- Rate limits on forms, checkout and AI endpoints. hCaptcha/Turnstile on opt-in forms.
