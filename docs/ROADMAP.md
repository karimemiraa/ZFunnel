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
- **3.5 SMS: done.** There is a per-workspace Twilio connection (Settings → SMS). The auth token is AES-256-GCM encrypted at rest (`SECRETS_KEY`, falling back to the auth secret) and never shown again. The “Send SMS” automation step is personalized, normalizes numbers to E.164, skips contacts without a phone or who unsubscribed, and logs failures without stopping the run. It was verified against a mock Twilio API. A compile-time guard now ensures every step and trigger type appears in the builder menus.
- **3.6 AI v2: done.** “Let AI write every page”: describe your business in the New funnel dialog, and every headline, paragraph, button, FAQ and testimonial placeholder in every step of the chosen template is rewritten for it, in a single request. The server only accepts ids it sent (the AI cannot touch block ids or settings), sanitizes HTML, and keeps the template copy if the AI fails. Plan-gated and quota-limited. Tested against a mock that returns hostile output.

**Deferred (needs external accounts or partner approval):** Google/Outlook calendar sync (OAuth app review), PayPal (separate merchant onboarding), Zapier/Make listings (their review process; our webhooks + API already work with their generic “Webhooks” apps), certificates and video hosting (v1 uses YouTube/Vimeo/Wistia/Bunny URLs).

## Phase 4 — Platform & scale (L)

E-commerce store (catalog, variants, cart, shipping, inventory; re-evaluate Medusa) · Community (spaces, posts, comments, notifications) · Affiliate center (links, multi-tier commissions, payouts report) · Message Hub (unified inbox: email + site chat + WhatsApp/SMS) · Agency mode & full white-label · Template/funnel marketplace + share-funnel links · ClickHouse for analytics at scale.

### Phase 4 plan (addendum, 2026-10-10)

The owner asked to continue through all phases without check-ins. Scope is v1 of each item; anything that needs outside approval or heavy infrastructure is listed as deferred.

| #   | Step               | Scope (v1)                                                                                                                                                                                                                           |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4.1 | Share funnels      | A public share link per funnel. Signed-in users preview it and import a full copy into any workspace they manage (counts toward the plan limit).                                                                                     |
| 4.2 | Affiliate center   | Affiliates sign up on the site and get a referral link (`?aff=code`, 30-day cookie). Commission (percent) on paid orders, per-affiliate stats, a payouts report with mark-as-paid, and an affiliate portal using the customer login. |
| 4.3 | Community          | Members-only spaces with posts and comments for signed-in customers (purchase- or course-gated). The owner can moderate and pin.                                                                                                     |
| 4.4 | Store              | Public `/store` catalog of products and a product page with “Buy now” into the existing checkout. Optional shipping address and stock count.                                                                                         |
| 4.5 | Message hub        | A site chat widget block. Visitor messages land in a unified inbox (chat + contact replies). Owner replies are emailed to the visitor.                                                                                               |
| 4.6 | White-label        | Organization branding (name, logo, color) on the dashboard, customer center, member area and transactional emails. “Powered by ZFunnel” can be removed on paid plans.                                                                |
| 4.7 | Analytics at scale | Decision record: stay on Postgres with partition-ready indexes until volume needs ClickHouse (ADR).                                                                                                                                  |

**Status**

- **4.1 Share funnels: done.** The Share dialog creates or revokes a random-token link. `/share/{token}` previews every page; signed-in users import a full copy (steps, drafts, flow links) into any workspace they manage, subject to plan limits. Products, contacts and settings are never copied. An e2e test covers import and revocation.
- **4.2 Affiliate center: done.** Settings cover on/off, commission % and cookie days, plus terms. Partners self-join at `/affiliate` (magic-link sign-in) and get a referral link and portal with clicks, referrals, pending and paid amounts. `?aff=` capture works site-wide. Checkout attribution respects the window and blocks self-referral. Commissions stay in sync with upsells and refunds, and the owner can mark them paid. See ADR-018.
- **4.3 Community: done.** Spaces can be open to all signed-in members or gated to a course's students. Members post and reply (sanitized) at `/community`, using the customer-center sign-in. The owner posts pinned announcements as the business and has a moderation feed (pin, hide or show posts and replies). Verified end to end.
- **4.4 Store: done.** Products can be listed in a public `/store` with stock limits and optional shipping address capture. Store orders run through the same checkout (Stripe or test gateway), decrement stock on payment, and show the ship-to address in Orders. Covered by `e2e/tests/store.spec.ts`.
- **4.5 Message hub: done.** Site chat bubble (toggle, greeting, brand color) on every public page. Visitors leave a name and email on the first message; threads land in **Inbox** with unread markers and open/closed views. Owner replies show in the widget and are emailed to the visitor with the recent thread. Covered by `e2e/tests/inbox.spec.ts`.
- **4.6 White-label: done.** Settings → Branding sets a logo and brand color used on the customer center, courses, store, blog, affiliate portal and built-in emails. A small “Powered by ZFunnel” badge shows on public pages and can be removed on Pro and Scale (ADR-019). Covered by `e2e/tests/white-label.spec.ts`.
- **4.7 Analytics at scale: decided.** Stay on Postgres with the existing indexes; partitioning and rollups when `events` passes ~50M rows or p95 passes 1s (ADR-020).

**Phase 4 complete.**

**Deferred:** WhatsApp/Messenger channels (Meta business verification), payout automation (Stripe Connect transfers to affiliates need KYC), a public marketplace with paid templates (moderation and payments policy), custom dashboard domains per agency (needs on-demand TLS for the app host).

## Phase 5 — Differentiators (M–L)

Live & evergreen webinars (LiveKit) · AI conversion coach (analyses funnel stats and suggests changes) · Server-side conversion API postbacks (Meta CAPI, Google Ads, TikTok) · Multi-currency + localized checkout.

### Phase 5 plan (addendum, 2026-10-10)

**Problem.** ClickFunnels users run webinars, track ads server-side and sell abroad. ZFunnel has none of this yet, and owners get raw stats but no advice on what to fix.

**Success criteria.** Each item works end to end in the browser and has an e2e test or, where an external service is involved, a mock-backed test. `pnpm verify` stays green.

| #   | Item                 | Scope                                                                                                                                                                                                                                                                                                                                               |
| --- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.1 | Webinars             | Webinar = video (YouTube/Vimeo/MP4 link) + schedule. **Evergreen**: sessions repeat (daily times or “just in time”). **Live**: one date with a stream embed. Registration page, reminder emails (24h/1h), a “watch room” that only plays from the scheduled start, offer button at a set minute, replay, “registered/attended” automation triggers. |
| 5.2 | AI conversion coach  | Per funnel: send step stats (views, opt-in/sale rates, split-test results, drop-off) plus the page copy to Claude. Get back ranked, concrete suggestions (what, why, expected effect), shown as cards on the funnel analytics page. Plan-gated like other AI features.                                                                              |
| 5.3 | Conversion postbacks | Settings → Tracking: Meta Conversions API (pixel id + token), TikTok Events API (pixel code + token), Google Analytics 4 Measurement Protocol (measurement id + API secret). Worker sends Lead and Purchase server-side with SHA-256-hashed email/phone, dedup event ids shared with the browser pixel, and a delivery log.                         |
| 5.4 | Multi-currency       | Correct zero-decimal (JPY, KRW…) and three-decimal (KWD, BHD…) handling. One currency per checkout, enforced when attaching offers. Revenue stats per currency, never summed across currencies. Prices formatted in the visitor's locale.                                                                                                           |

**Constraints and pushback.**

- **No self-hosted LiveKit.** The VPS also runs other apps, and an SFU needs many UDP ports, lots of bandwidth and a TURN server, which would risk them. Live sessions embed an external stream (YouTube Live, Vimeo, Zoom webinar link) instead. LiveKit Cloud can be added later behind the same “live” type.
- **No Google Ads API.** It needs OAuth plus a developer token approved by Google, so Google conversions go through GA4, which can import them into Google Ads.
- Ad platform tokens are stored encrypted (`sealSecret`). Each workspace owns its pixels.

**Build order.** 5.4 (small, touches money code everyone uses) → 5.3 → 5.2 → 5.1.

- **5.4 Multi-currency: done.** 30 currencies with correct minor units: JPY and KRW have no decimals; KWD, BHD, OMR and JOD have three. Money helpers now live in `@zfunnel/shared` and are used by the dashboard, payments and checkout blocks. A funnel sells in one currency (checked when attaching an offer). Revenue stats and analytics show the main currency, list others separately, and never add them together. Checkout prices use the visitor's locale. Also fixed: the product dialog no longer clears the form after a validation error. Covered by `e2e/tests/currency.spec.ts`.
- **5.3 Conversion postbacks: done.** Settings → Tracking connects Meta CAPI, TikTok Events API and GA4 Measurement Protocol (tokens encrypted). Lead and Purchase go out from the worker with hashed identifiers, click ids and deterministic event ids. A delivery log shows the status of each (ADR-021). Payload builders are unit-tested; `e2e/tests/tracking.spec.ts` verifies the whole path against a recording mock.
- **5.2 AI conversion coach: done.** Analytics → pick a funnel → “Analyze my funnel”. The coach gets each step's visitors, conversion rate and revenue for the selected range plus the published copy, and returns a summary with 3–6 ranked suggestions (step, change, why, impact). Answers are parsed strictly: plain text only, step names must match real steps. Plan-gated like other AI features, 30 runs per hour per workspace. Unit tests cover prompt and parser; `e2e/tests/coach.spec.ts` runs against the AI mock.
- **5.1 Webinars: done.** Dashboard → Webinars. Evergreen schedules (weekdays × times, plus “just in time” sessions every 15 minutes) or a one-time live event (embedded stream). Branded registration page at `/webinar/<slug>`. A personal watch room with a countdown, simulated live playback that joins at the right second and can't be skipped, replay window, and a timed offer button. Confirmation plus 24-hour and 1-hour reminder emails. Registered, attended and offer-click stats. New automation triggers and webhooks: `webinar_registered` / `webinar_attended` (ADR-022). Covered by `e2e/tests/webinar.spec.ts` and unit tests for scheduling and video links.

**Phase 5 complete.**

---

## Phase 6 — Native Arabic (L)

### Phase 6 plan (2026-10-10)

**Problem.** Arabic-speaking businesses can't use ZFunnel comfortably. They can't run the dashboard in Arabic, and their customers see English checkouts, forms, emails and member areas, laid out left-to-right.

**What "native" means here.** Arabic is written as an Arab copywriter would write it, not as word-for-word translation:

- Modern Standard Arabic in a warm, direct marketing voice.
- Sentences restructured to read naturally.
- Established Arab marketing terms (قمع المبيعات, عرض ترقية, صفحة الاشتراك).
- Arabic grammar for numbers. Arabic has six plural forms (zero/one/two/few/many/other); every count uses them.
- Right-to-left layout everywhere, with direction-aware icons.
- A proper Arabic typeface.
- A shared glossary (`docs/ARABIC.md`) keeps terms consistent.

**Success criteria.**

1. A user can switch the dashboard to Arabic. Every screen reads naturally right-to-left, and no English is left in the dashboard's own UI.
2. A workspace can set its site language to Arabic. Public pages, checkout, forms, customer center, courses, community, store, blog, webinar, chat and every built-in email are then Arabic and RTL.
3. Arabic funnel templates written from scratch (not translated) exist for the main funnel types.
4. Missing Arabic strings fail the type check, so nothing silently falls back to English.
5. An e2e test runs a full Arabic flow: dashboard, publish, opt-in, checkout.

**Scope.**

| #   | Item             | Scope                                                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 6.1 | i18n foundation  | `@zfunnel/i18n`: typed English and Arabic dictionaries (Arabic must cover every key), interpolation and Arabic plural rules via `Intl.PluralRules`. Dashboard language per user (cookie plus profile). Site language per workspace. `<html lang dir>`, an Arabic webfont, and RTL-safe CSS: logical properties instead of left/right, mirrored arrows. |
| 6.2 | Public side      | Checkout and order form, opt-in and survey forms, upsells, customer center, courses, community, store, blog, webinar, chat widget, affiliate portal, error messages, and all built-in emails.                                                                                                                                                          |
| 6.3 | Dashboard        | Every screen, dialog, toast and validation message.                                                                                                                                                                                                                                                                                                    |
| 6.4 | Arabic templates | Funnel and email templates written natively in Arabic.                                                                                                                                                                                                                                                                                                 |
| 6.5 | Deploy           | Production config for `zf.zealmarketing.net`.                                                                                                                                                                                                                                                                                                          |

**Decisions (recorded as ADR-023).**

- **Digits.** Western digits (`ar-u-nu-latn`) by default. They're standard in Gulf marketing and match card and phone inputs.
- **Editor chrome.** The drag-and-drop editor's own chrome (Puck library) stays English. The page being edited follows the site language and direction.
- **User content.** Content the user writes is never auto-translated.

**Deployment constraint.** This environment can't open SSH connections. The owner runs the deploy script on the server; config for the domain is prepared here.

- **6.1 Foundation: done.**
  - `@zfunnel/i18n` holds typed dictionaries. Arabic must cover every English key (a type error otherwise). Plurals use `Intl.PluralRules` (all six Arabic forms).
  - The dashboard language is per user (switch in the account menu). The site language is per workspace (Settings → General).
  - Pages set `lang`/`dir`. Noto Sans Arabic is in every font stack.
  - Layout uses logical CSS (start/end) and direction arrows are mirrored.
  - The editor canvas and draft previews use the site's direction.
- **6.2 Public side and emails: done.**
  - Checkout and order form (including Stripe's own fields), opt-in and survey forms (Arabic option letters أ ب ج), countdown and upsell.
  - Store, customer center, courses, community, blog and RSS, booking (week starts on Sunday), affiliate portal, webinars, chat widget, 404 and the "Powered by" badge.
  - Every visitor-facing API error, built-in emails (right-to-left layout) and the marketing email footer and unsubscribe page.
  - Covered by `e2e/tests/arabic.spec.ts`: an RTL store purchase with an Arabic decline error and the Arabic customer center.
- **6.3 Dashboard: done.**
  - Every screen, dialog, toast, validation and server message has English and natively written Arabic, across about 40 namespaces.
  - Dates, money and relative times follow the user's language. Data the dashboard creates (default stages, starter lessons, starter emails) is written in the creator's language.
  - The AI coach answers in Arabic when the dashboard is in Arabic.
- **6.4 Arabic templates: done.**
  - All 11 funnel templates and every starter page are written natively in Arabic, adapted to the market (for example an Arabic calligraphy course, times in Mecca time, Arabic testimonials).
  - Every block has Arabic default text, and the editor uses it on Arabic sites.
  - Tests check that no English is left in Arabic templates.
- **6.5 Deploy: prepared.** `infra/deploy/setup-env.sh zf.zealmarketing.net <email>` generates the production config. DNS records and steps are in `docs/DEPLOYMENT.md`. The owner runs `deploy.sh` on the VPS.

**Phase 6 complete.** `e2e/tests/arabic.spec.ts` covers an Arabic RTL purchase and an Arabic dashboard.

---

## Phase 7 — Platform owner, brand, ClickFunnels import (M–L)

### Phase 7 plan (2026-10-10) — signed off

**Problem.**

1. The platform owner can't see or manage the platform as a whole: sign-ups, organizations, plans, abuse.
2. The product still carries a placeholder look rather than the ZFunnel brand: an orange and white "Z" on deep navy.
3. The owner's existing funnels live in ClickFunnels, and moving them by hand is slow.

**Success criteria.**

1. Only accounts listed as platform admins can open `/admin`. Everyone else gets a 404.
2. Admins can see every organization, workspace and user, with sign-up date, plan, usage and revenue.
3. Admins can suspend or unsuspend an organization and change its plan.
4. Every admin action is written to an audit log.
5. The logo, favicon, colors, auth screens, emails and the "Powered by" badge all carry the new brand, in light and dark mode, in English and Arabic.
6. A published ClickFunnels page URL can be imported as an editable ZFunnel funnel step, with its images copied over.
7. Contacts can be imported from the ClickFunnels CSV export.

**Scope.**

| #   | Item                | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.1 | Super admin         | Admin access comes from `PLATFORM_ADMIN_EMAILS` in the server `.env`, and the email must be verified. A separate admin area at `/admin` has: an overview (sign-ups, active organizations, MRR, GMV and a 30-day trend), lists of organizations, workspaces and users with search, an organization detail page (members, workspaces, plan, usage), suspend/unsuspend, plan override, and the admin audit log. Platform-wide reads go through `withSystem` behind an admin guard. No silent "log in as user". |
| 7.2 | Rebrand and UI pass | The logo as SVG (mark plus wordmark), favicon and app icons, and brand tokens (orange `#F28A22`, navy `#001A57`) in light and dark mode. Updated auth and onboarding screens, sidebar, empty states, email header and the badge. A polish pass on spacing, typography and contrast across the main screens.                                                                                                                                                                                                 |
| 7.3 | ClickFunnels import | Paste one or more published page URLs. The server fetches each page and turns it into ZFunnel blocks (headings, text, images, buttons, video, lists, forms becoming opt-in forms). Anything it can't map is kept as a custom-HTML block, so nothing is lost. Images are copied to our storage. Contacts come in through the existing CSV import, with the ClickFunnels column names pre-mapped.                                                                                                             |

**Honest limits of the import.**

- ClickFunnels has no export of its page designs. We can only read the published pages, the same way a browser does.
- The text, images, structure and colors come over. The pixel-exact layout and animations will need touch-up in the editor.
- Products, prices, order bumps, automations and email sequences can't be read from a page. They must be recreated, which is quick with the templates.
- Only pages you own may be imported. The import tool says so.

**Owner decisions.**

**7.3 status: Done.** Funnels → **Import from ClickFunnels** takes up to 10 published URLs (one step each, in order), a funnel name and an ownership confirmation. Pages are fetched through the SSRF-safe `safeFetch` in `@zfunnel/shared/net` and converted by `@zfunnel/blocks/import`. It recognizes classic CF (`data-de-type`, `.elHeadline`…), CF 2.0 (`data-page-element`) and plain HTML, and maps headings, text, images, buttons, YouTube/Vimeo/Wistia video, bullet lists, section colors and background images, 2–4 columns, opt-in forms, order forms (→ checkout step) and countdowns. Anything else becomes a sanitized custom-HTML block. Images (up to 30 per page, 5 MB each, raster only) are copied into the new `media_files` table and served from `/api/media/{id}` on the public site. The import runs synchronously, with no job queue (ADR-025). The contacts CSV import now reads ClickFunnels classic and 2.0 headers, including first and last name and the created date. The user guide is `docs/IMPORT.md`. **Later:** popups, multi-step CF forms and custom fields from the CSV.

**Open questions for the owner.**

1. The first super admin is `karim@zealmarketing.net`, the account already registered.
2. The admin area stays at `app.zf.zealmarketing.net/admin`.
3. Admins can "view as" a customer: read-only, logged, with a visible banner.
4. Import volume: about 5–10 ClickFunnels funnels.

**7.2 status: done (2026-10-10).** The mark is hand-drawn SVG from the source artwork in three variants (app icon, mark for dark and light backgrounds, wordmark), used for the favicon, the apple-touch icon, the dashboard and the "Powered by" badge. Brand tokens in light and dark mode only style the platform chrome; funnel pages keep their own themes. Primary is a darker orange (`#B85A06`, AA with white) on light backgrounds and the bright orange with navy text in dark mode. The auth screens have a branded navy panel, onboarding has a navy brand band, and the sidebar, workspace home, page headers and empty states were polished. Customer emails stay in the workspace's own brand, and the platform sends no emails of its own yet, so no email header changed. See `docs/brand/README.md`.

**Owner decisions (7.1).** First admin: `karim@zealmarketing.net`. The area stays at `app.…/admin` on the same host. "View as" is allowed, read-only, logged and with a visible banner.

### 7.1 status — **Done** (2026-10-10)

- `/admin`: an overview (sign-ups total and last 30 days, organizations, active organizations, workspaces, platform MRR from `org_billing`, GMV from paid orders, and a 30-day sign-ups chart), organizations with search and pagination, an organization page (members, workspaces, plan, funnel/contact/order counts), users with search, and the admin audit log.
- Actions: suspend/unsuspend (members get a suspended screen; public sites show a neutral "unavailable" page), plan override, and read-only "view as" with a banner and an exit button.
- Access: `PLATFORM_ADMIN_EMAILS` plus a verified email. Everyone else gets a 404. An **Admin** link appears in the account menu for admins.
- New platform tables `platform_audit_log` and `organization_suspensions` (migrations 0051–0052, system-only writes). Design in ADR-024; setup in `docs/DEPLOYMENT.md` §9.
- English and Arabic (`admin` namespace). Tests: guard and token unit tests, RLS tests for both tables, and `e2e/tests/admin.spec.ts`.

---

## Working agreement

1. Every phase starts with a short phase PRD addendum and needs sign-off.
2. Every architectural choice is logged in `DECISIONS.md`.
3. Every PR: tests + lint + license check green; e2e for money paths.
4. `docs/` is updated in the same PR as the change it describes.
