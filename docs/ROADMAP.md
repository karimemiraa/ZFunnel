# ZFunnel — Build Roadmap

> Status: **DRAFT — each phase needs explicit sign-off before work starts.**
> Size: S ≈ days, M ≈ 1–2 weeks, L ≈ 3+ weeks (for one dev working with Claude). Re-estimate once team/timeline (PRD §9 Q6) is known.

Each step lists what gets delivered and the **acceptance test** that proves it is done.

---

## Phase 0 — Foundation (M) — ✅ built 2026-10-10, awaiting your review

| #   | Step              | Status | What was delivered                                                                                                                                        | Acceptance evidence                                                                                                                                            |
| --- | ----------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1 | Monorepo scaffold | ✅     | pnpm + Turborepo; `apps/web`, `apps/sites`, `apps/worker`; `packages/{config,db,auth,ui,shared}`; Prettier                                                | `pnpm build`, `lint`, `typecheck`, `format:check` pass; build works without a `.env`                                                                           |
| 0.2 | Local infra       | ⚠️     | Compose with Postgres (+ non-superuser app role), Redis, Mailpit. S3 storage moved to Phase 1 (MinIO stopped publishing images).                          | Image tags verified on Docker Hub; Compose itself not run (no Docker daemon in the build environment). Start: `pnpm infra:up` → `pnpm db:migrate` → `pnpm dev` |
| 0.3 | CI + license gate | ✅     | GitHub Actions: license gate, format, lint, typecheck, tests (incl. RLS against real Postgres), build                                                     | Gate verified to fail when a non-permissive package (CKEditor) is added                                                                                        |
| 0.4 | App shell + auth  | ✅     | Better Auth (email/password, organizations). From nextjs/saas-starter we harvested the shadcn components; its custom JWT auth and schema were not needed. | Browser test: sign up, onboarding, sign out                                                                                                                    |
| 0.5 | Tenancy           | ✅     | Organization → workspaces; roles owner/admin/member; `workspaces` + `audit_logs` with FORCE row-level security                                            | 7 integration tests: no context sees nothing, cross-tenant reads/writes/updates/deletes blocked; browser: other user gets 404                                  |
| 0.6 | UI shell          | ✅     | Sidebar (all modules, "Soon" badges), workspace switcher, light/dark/system theme, mobile slide-over nav, empty states, settings (general/team/activity)  | Screenshots reviewed on desktop and phone width                                                                                                                |

Deferred from Phase 0 on purpose: team invitations (need email sending, Phase 2.3), a committed Playwright suite (Phase 1.12; Phase 0 was verified with a scripted browser run).

## Phase 1 — MVP: Funnel → Checkout → Upsell (L) — ✅ built 2026-10-10

| #    | Step                  | Status | What was delivered                                                                                                                                       |
| ---- | --------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1  | Block library         | ✅     | 24 blocks (`packages/blocks`): layout, content, conversion, social proof, checkout; theme presets, 8 self-hosted fonts                                   |
| 1.2  | Editor                | ✅     | Puck with custom header: autosave, undo/redo, step switcher, desktop/tablet/mobile, ⌘S, publish. Per-device visibility instead of per-breakpoint styles. |
| 1.3  | Funnel map            | ✅     | Step list (reorder, duplicate, delete) + React Flow map with next/decline wiring                                                                         |
| 1.4  | Publishing + renderer | ✅     | Immutable page versions, draft preview, live thumbnails, `apps/sites` with SEO metadata                                                                  |
| 1.5  | Domains               | ✅     | Free subdomain + custom domains (TXT ownership, CNAME/A routing, Caddy on-demand TLS ask endpoint). Live TLS is verified at deploy time.                 |
| 1.6  | Products & Stripe     | ✅     | Products with one-time, subscription (trials) and payment-plan prices; Stripe Connect onboarding; webhook                                                |
| 1.7  | Checkout              | ✅     | Order form (1- or 2-step), product choice, order bumps, Stripe Payment Element; built-in test gateway                                                    |
| 1.8  | One-click upsells     | ✅     | Off-session charges with 3-D Secure fallback, downsells, replay-safe                                                                                     |
| 1.9  | Contacts              | ✅     | Opt-ins and buyers with UTM attribution and consent proof                                                                                                |
| 1.10 | Analytics             | ✅     | Cookieless events; visitors, leads, sales, revenue, EPV, daily charts, per-step conversion                                                               |
| 1.11 | Templates             | ✅     | 10 themed funnel templates + gallery with live thumbnails                                                                                                |
| 1.12 | E2E suite             | ✅     | Playwright: lead funnel, checkout + bump + upsell, declined card, tenant isolation; runs in CI                                                           |

**Verified without real Stripe keys:** every Stripe request is contract-tested against stripe-mock, and the full purchase flow runs end to end on the test gateway. **Still to verify with real keys:** Stripe Connect onboarding, the Payment Element in the browser, 3-D Secure on upsells, and webhooks. Needs `STRIPE_*` keys (test mode first).

## Phase 2 — Marketing engine (L)

| #    | Step                      | Deliverable                                                                                                                                                                                 |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1  | CRM                       | Contacts with tags, custom fields, segments (rule builder), activity timeline, import/export CSV                                                                                            |
| 2.2  | Pipelines                 | Kanban pipelines and opportunities (atomic-crm patterns)                                                                                                                                    |
| 2.3  | Email infra               | Sender adapters, per-workspace sending domain wizard (SPF/DKIM/DMARC), bounce/complaint webhooks, suppression list, unsubscribe                                                             |
| 2.4  | Email editor + broadcasts | maily.to-based editor, templates, broadcasts to segments, A/B subject, open/click tracking                                                                                                  |
| 2.5  | Automations               | React Flow workflow builder. Triggers: opt-in, purchase, tag added, form submitted, date, webhook. Actions: email, tag, wait, if/else, webhook, CRM move, course grant. Run history + logs. |
| 2.6  | Sequences                 | Drip sequences as a simplified view of automations                                                                                                                                          |
| 2.7  | Forms, surveys & quizzes  | Multi-step form block with conditional logic and scoring; routes to offers                                                                                                                  |
| 2.8  | A/B split tests           | Page variants, edge assignment, significance, "promote winner" button                                                                                                                       |
| 2.9  | Customer center           | Order history, invoices, subscription cancel/upgrade (Stripe portal + our UI)                                                                                                               |
| 2.10 | AI v1                     | Rewrite/generate copy in the editor; AI email writer                                                                                                                                        |
| 2.11 | ZFunnel's own billing     | Plans, limits (contacts, emails, domains, workspaces), usage metering, trial                                                                                                                |

### Phase 2 status

| #       | Status      | Notes                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1–2.2 | Done        | Tags, custom fields, segment rule builder, timeline, CSV import/export, kanban pipelines.                                                                                                                                                                                                                                                                                                                         |
| 2.3     | Done (core) | SMTP sending via worker queue (10/s), signed open/click/unsubscribe links, RFC 8058 one-click unsubscribe, hard-bounce handling, required postal address. **Later:** sending-domain wizard (SPF/DKIM/DMARC check) and provider bounce webhooks.                                                                                                                                                                   |
| 2.4     | Done (core) | Puck-based email editor (we chose Puck over maily.to so pages and emails share one editor; see ADR log), broadcasts to all/segment/tag, test send, schedule, per-broadcast open/click stats. **Later:** A/B subject lines, saved templates.                                                                                                                                                                       |
| 2.5–2.6 | Done (core) | Visual builder (React Flow, auto-layout, “+” to insert), recipes (welcome series, customer onboarding). Triggers: opt-in, purchase, tag added, manual. Steps: send email, wait, if/else, add/remove tag, webhook. Durable executor, per-contact activity log. **Later:** date/webhook triggers, course grant, pipeline move, SMS.                                                                                 |
| 2.7     | Done        | “Form / survey / quiz” block: one-question-at-a-time or all-on-one-page, 8 answer types, save answers to contact fields, tags, quiz scoring with result tiers (tag + optional redirect). Server re-reads the published definition and scores; points never reach the browser. Forms dashboard with per-question charts, responses table, CSV export. Quiz funnel template. Triggers “Submits a form” automations. |
| 2.8     | Done        | A/B split tests per step: create variant B from the current page, edit/preview/publish it, traffic slider, sticky assignment, per-version visitors, conversions and rate with a significance check, one-click “winner”. See ADR-016.                                                                                                                                                                              |
| 2.9     | Done (core) | Customer center at `{site}/account`: passwordless, single-use 30-minute email link, signed 7-day session; purchases and subscriptions; cancel at period end / resume (Stripe API or test gateway). Test-mode checkouts now record subscriptions like Stripe. **Later:** update card (Stripe billing portal), invoices/receipts, course access (Phase 3).                                                          |
| 2.10    | Done        | AI copywriter in the page and email editors: rewrite the selected heading, text or button (quick actions or a custom instruction), preview, then “Use this”. AI subject lines in broadcasts. Anthropic Messages API over fetch, per-workspace hourly limit, sanitized output, never invents facts. Optional: hidden behind `ANTHROPIC_API_KEY`.                                                                   |
| 2.11    | Done        | Plans (Starter/Pro/Scale, **placeholder prices**) with limits and feature gates; 14-day trial; usage meters; Stripe Checkout + Customer Portal on the platform account; platform webhook; test-mode activation; trial/past-due banners. See ADR-017.                                                                                                                                                              |

## Phase 3 — Products beyond funnels (L)

Courses & memberships (modules, lessons, drip, video hosting, progress, quizzes, certificates) · Appointments (cal.diy-derived availability, Google/Outlook sync, paid bookings) · Websites & blog (menus, SEO, sitemap, RSS) · SMS via Twilio in workflows · Public REST API + webhooks + Zapier/Make apps · AI v2 (prompt → full funnel, image generation) · PayPal gateway.

### Phase 3 plan (addendum, 2026-10-10)

The owner asked to build all remaining phases without stopping, so this plan was not sent for sign-off.

**Build order:** most revenue impact first, and each step reuses what already exists.

| #   | Step                  | Scope (v1)                                                                                                                                                                                                                                                                   | Success criteria                                                                                                             |
| --- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 3.1 | Courses               | Courses → modules → lessons (video URL + rich text), drip by days after enrollment, free preview lessons. Access granted by buying linked products, by an automation step, or manually. Student area on the public site, using the customer-center login. Progress tracking. | A buyer of a linked product signs in, sees the course, completes lessons and sees progress. Locked drip lessons stay locked. |
| 3.2 | Appointments          | Booking calendars: weekly availability, duration, buffer, minimum notice and timezone. A public booking page with time slots, a confirmation email and a contact + activity record. A “Booked” automation trigger.                                                           | A visitor books a free slot, the slot disappears, and the owner sees the booking.                                            |
| 3.3 | Websites & blog       | Blog posts (rich text, cover image, SEO), a public `/blog` index and post pages, `sitemap.xml`, `robots.txt` and an RSS feed.                                                                                                                                                | Published posts are crawlable and listed in the sitemap and RSS.                                                             |
| 3.4 | Public API + webhooks | Workspace API keys (hashed), a REST API for contacts, orders and courses (enroll), and outgoing webhooks for opt-ins, purchases, form submissions and bookings, signed with HMAC.                                                                                            | Create a contact with an API key. A webhook receives a signed purchase event.                                                |
| 3.5 | SMS                   | A Twilio “Send SMS” automation step (per-workspace credentials).                                                                                                                                                                                                             | The step sends through Twilio. Without credentials it is skipped and logged.                                                 |
| 3.6 | AI v2                 | Generate a complete funnel (copy for every block) from a short business description.                                                                                                                                                                                         | A prompt creates a ready-to-edit funnel.                                                                                     |

**Status**

- **3.1 Courses: done.** Covers modules and lessons (video embed + rich text), drip, free previews and up/down reordering. Access comes from linked products (granted inside `markPaymentSucceeded`, so the Stripe webhook path is covered too), the “Give course access” automation step, or manual enrollment and revocation. Students sign in at `{site}/courses` using the customer-center magic link and land back on the page they came from. Progress is tracked per lesson, and owners see students' progress.
- **3.2 Appointments: done.** Calendars have weekly availability windows per day, duration, buffer, minimum notice, a booking horizon and an IANA timezone. Slot math is DST-safe and unit-tested. The public `/book/{slug}` page shows a month calendar and times in the visitor's timezone. The server re-checks every slot, and a partial unique index makes double booking impossible. Each booking creates or updates the contact, logs activity, sends a confirmation email with an “Add to Google Calendar” link, and fires the “Books an appointment” trigger. Owners can cancel bookings. The e2e test covers the whole flow.
- **3.3 Blog: done.** Posts support rich text (sanitized; article mode allows headings, quotes, code and https images), a cover image, an excerpt, SEO title and description with a Google preview, and publish/unpublish. Public `/blog` index and post pages carry Open Graph tags and BlogPosting JSON-LD. Each site also serves `/blog/rss.xml`, `/sitemap.xml` (landing steps, posts and booking pages) and `/robots.txt`. An e2e test covers it. Menus and multi-page websites can already be built from funnel steps.
- **3.4 API + webhooks: done.** Workspace API keys are stored hashed, shown once and revocable, with rate limits. Endpoints: `/api/v1` me, contacts (list/upsert/get), orders and course enrollments. The e2e test covers tenant isolation and revocation. Signed webhooks (HMAC with a timestamp) cover opt-in, tag, order paid, form and booking events. They fan out from the worker's event stream, are idempotent per event, retried with backoff and SSRF-guarded, and have a test button and a delivery log. See `docs/API.md`.

**Deferred (needs external accounts or partner approval):** Google/Outlook calendar sync (OAuth app review), PayPal (separate merchant onboarding), Zapier/Make listings (their review process; our webhooks + API already work with their generic “Webhooks” apps), certificates and video hosting (v1 uses YouTube/Vimeo/Wistia/Bunny URLs).

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
