# ZFunnel — Build Roadmap

> Status: **DRAFT — each phase needs explicit sign-off before work starts.**
> Size: S ≈ days, M ≈ 1–2 weeks, L ≈ 3+ weeks (for one dev working with Claude). Re-estimate once team/timeline (PRD §9 Q6) is known.

Each step lists what gets delivered and the **acceptance test** that proves it is done.

---

## Phase 0 — Foundation (M)

| # | Step | Deliverable | Acceptance |
|---|---|---|---|
| 0.1 | Monorepo scaffold | pnpm + Turborepo, `apps/web`, `apps/sites`, `apps/worker`, `packages/*`, shared tsconfig/eslint/tailwind | `pnpm build`, `pnpm lint` and `pnpm typecheck` pass on a clean clone |
| 0.2 | Local infra | `infra/docker/docker-compose.yml` with Postgres, Redis, Mailpit and MinIO | `pnpm dev` boots everything with one command |
| 0.3 | CI + license gate | GitHub Actions: lint, typecheck, unit tests, license allow-list | A PR that adds an AGPL dependency fails CI |
| 0.4 | Seed `apps/web` from nextjs/saas-starter | Vendored, reorganized into the monorepo, auth swapped to Better Auth | Sign up, log in, log out |
| 0.5 | Tenancy | Organizations → workspaces → members/roles; Drizzle schema + RLS policies | Integration test: user A cannot read workspace B's rows |
| 0.6 | UI shell | shadcn sidebar layout, workspace switcher, dark mode, empty states | Visual review sign-off |

## Phase 1 — MVP: Funnel → Checkout → Upsell (L)

| # | Step | Deliverable | Acceptance |
|---|---|---|---|
| 1.1 | Block library v1 | `packages/blocks`: section, row, columns, headline, text (Tiptap), image, video, button, spacer, divider, list, form (opt-in), countdown, testimonial, FAQ, pricing, custom HTML | Each block renders identically in editor and renderer (snapshot tests) |
| 1.2 | Editor | Puck integration: drag/drop, per-breakpoint styles (desktop/tablet/mobile), global theme (colors, fonts), undo/redo, autosave, saved sections | Build a full sales page with no code, on desktop and mobile |
| 1.3 | Funnel map | React Flow canvas: add/reorder steps, step types, accept/decline routing | Create a 5-step funnel visually |
| 1.4 | Publishing + renderer | Immutable `PageVersion` snapshots; `apps/sites` renders from them; edge cache purged on publish | Lighthouse ≥ 90; dashboard down ⇒ pages still serve |
| 1.5 | Domains | `{slug}.zfunnel.app` + custom domains with DNS verification wizard and automatic SSL | Connect a real domain end-to-end in under 5 min |
| 1.6 | Products & Stripe Connect | Connect Stripe; products, one-time and subscription prices, coupons | Product created in ZFunnel appears in the user's Stripe account |
| 1.7 | Checkout | Order-form block (1-step and 2-step), order bump, Payment Element, tax via Stripe Tax | Test-mode purchase with bump succeeds |
| 1.8 | One-click upsell/downsell | Saved payment method → off-session charge, SCA fallback, accept/decline routing | E2E: buy → upsell "yes" charges with no card re-entry; "no" → downsell |
| 1.9 | Contacts (basic) | Opt-in form → contact record, order history on contact | Opt-in appears in contact list with UTM data |
| 1.10 | Analytics v1 | Tracker + events; per-step views, opt-ins, sales, revenue, conversion % | Numbers match a scripted test run exactly |
| 1.11 | Templates | 10 starter funnels (lead magnet, tripwire, webinar reg, product launch, VSL, application, book, coaching, SaaS trial, e-com single product) | A new user goes from template to published funnel |
| 1.12 | E2E suite | Playwright: signup → template → edit → publish → buy → upsell → see analytics | Green in CI |

**MVP release gate:** all of PRD §3 success criteria pass with a non-technical tester.

## Phase 2 — Marketing engine (L)

| # | Step | Deliverable |
|---|---|---|
| 2.1 | CRM | Contacts with tags, custom fields, segments (rule builder), activity timeline, import/export CSV |
| 2.2 | Pipelines | Kanban pipelines and opportunities (atomic-crm patterns) |
| 2.3 | Email infra | Sender adapters, per-workspace sending domain wizard (SPF/DKIM/DMARC), bounce/complaint webhooks, suppression list, unsubscribe |
| 2.4 | Email editor + broadcasts | maily.to-based editor, templates, broadcasts to segments, A/B subject, open/click tracking |
| 2.5 | Automations | React Flow workflow builder. Triggers: opt-in, purchase, tag added, form submitted, date, webhook. Actions: email, tag, wait, if/else, webhook, CRM move, course grant. Run history + logs. |
| 2.6 | Sequences | Drip sequences as a simplified view of automations |
| 2.7 | Forms, surveys & quizzes | Multi-step form block with conditional logic and scoring; routes to offers |
| 2.8 | A/B split tests | Page variants, edge assignment, significance, "promote winner" button |
| 2.9 | Customer center | Order history, invoices, subscription cancel/upgrade (Stripe portal + our UI) |
| 2.10 | AI v1 | Rewrite/generate copy in the editor; AI email writer |
| 2.11 | ZFunnel's own billing | Plans, limits (contacts, emails, domains, workspaces), usage metering, trial |

## Phase 3 — Products beyond funnels (L)

Courses & memberships (modules, lessons, drip, video hosting, progress, quizzes, certificates) · Appointments (cal.diy-derived availability, Google/Outlook sync, paid bookings) · Websites & blog (menus, SEO, sitemap, RSS) · SMS via Twilio in workflows · Public REST API + webhooks + Zapier/Make apps · AI v2 (prompt → full funnel, image generation) · PayPal gateway.

## Phase 4 — Platform & scale (L)

E-commerce store (catalog, variants, cart, shipping, inventory; re-evaluate Medusa) · Community (spaces, posts, comments, notifications) · Affiliate center (links, multi-tier commissions, payouts report) · Message Hub (unified inbox: email + site chat + WhatsApp/SMS) · Agency mode & full white-label · Template/funnel marketplace + share-funnel links · ClickHouse for analytics at scale.

## Phase 5 — Differentiators (M–L)

Live & evergreen webinars (LiveKit) · AI conversion coach (analyses funnel stats and suggests changes) · Server-side conversion API postbacks (Meta CAPI, Google Ads, TikTok) · Multi-currency + localized checkout.

---

## Working agreement

1. Every phase starts with a short phase PRD addendum and needs sign-off.
2. Every architectural choice is logged in `DECISIONS.md`.
3. Every PR: tests + lint + license check green; e2e for money paths.
4. `docs/` is updated in the same PR as the change it describes.
