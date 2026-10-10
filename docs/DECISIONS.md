# Decision Log (ADRs)

Format: **ID — Title** · Status (Proposed / Accepted / Superseded) · Date. Short context, decision, consequences.

---

### ADR-001 — Compose from libraries, don't fork a whole app · Proposed · 2026-10-10

**Context.** No open-source ClickFunnels clone is mature enough. The best match, autonnel, has 24 stars and is built on Astro. Combining full apps (Listmonk/Go, Mautic/PHP, Discourse/Ruby, Plausible/Elixir) would mean many stacks, databases and auth systems.

**Decision.** Build a single TypeScript monorepo. Use mature permissive libraries (Puck, Tiptap, React Flow, BullMQ, Better Auth, react-email, shadcn) and harvest code from MIT apps (Umami, atomic-crm, cal.diy, dittofeed). Run separate services only for infrastructure (Caddy, LiveKit, optional Postal).

**Consequences.** We write the funnel, checkout, upsell, course, community and affiliate logic ourselves, but on proven foundations. There is one deployment model and one data model.

### ADR-002 — Permissive licenses only in the core · **Accepted** · 2026-10-10

**Context.** ZFunnel is a paid, proprietary SaaS (confirmed 2026-10-10). AGPL, GPL, SSPL, FSL and Sustainable Use code would force us to open-source it or would breach its license terms.

**Decision.** Embed only MIT, Apache, BSD or ISC code, enforced by `scripts/check-licenses.mjs` in CI. Reviewed exceptions (unmodified LGPL/MPL build tooling pulled in by Next.js and Tailwind) are listed with reasons in that script. Copyleft projects are design references only.

**Consequences.** Courses, community and affiliate features are built in-house. If ZFunnel goes open-source under AGPL, this ADR is revisited and a lot more becomes reusable.

### ADR-003 — Puck as the page editor (GrapesJS as fallback) · Proposed · 2026-10-10

**Context.** The editor is the most important part of the UX. Puck (MIT, 13.4k stars, active) stores typed JSON and renders React components, so the same blocks work in the editor and on published pages. GrapesJS (BSD-3, 26k stars) is more mature but outputs HTML/CSS strings.

**Decision.** Puck plus Tiptap for inline text. Run a 3–5 day spike in Phase 1.2: if Puck can't handle nested rows/columns, per-breakpoint styling and editing performance on 100+ blocks, switch to GrapesJS.

**Consequences.** Blocks are React components with zod-validated props. This also makes AI-generated pages safe, because the output is validated JSON rather than arbitrary HTML.

### ADR-004 — Separate public renderer app · Proposed · 2026-10-10

**Decision.** `apps/sites` serves published pages from immutable snapshots with edge caching, isolated from `apps/web`.

**Consequences.** Faster pages, better uptime and cookie isolation, at the cost of one more deployable.

### ADR-005 — Stripe Connect as the primary gateway · Proposed · 2026-10-10

**Decision.** Users connect their own Stripe accounts. One-click upsells use saved payment methods charged off-session. Other gateways sit behind `packages/payments` adapters.

**Consequences.** Funds go straight to users; we never hold money. Platform fees remain an option through `application_fee_amount`.

### ADR-006 — BullMQ for jobs and workflow waits · Proposed · 2026-10-10

**Decision.** Use BullMQ on Redis, with workflow run state persisted in Postgres. Revisit trigger.dev (Apache-2.0) if workflow complexity outgrows it.

### ADR-007 — Tenant isolation with Postgres row-level security · **Accepted** · 2026-10-10

**Context.** One forgotten `WHERE workspace_id = …` would leak one customer's data to another.

**Decision.**

- Tenant tables have `FORCE ROW LEVEL SECURITY`.
- Policies read transaction-local settings (`app.organization_id`, `app.workspace_id`) set by `withOrganization` / `withWorkspace` in `packages/db/src/tenant.ts`.
- Workspace-scoped rows also require the workspace to belong to the current organization.
- The app connects as a **non-superuser** role, because superusers bypass RLS.
- Platform code that must work across tenants (the public renderer resolving a hostname, the subdomain availability check, workers) uses `withSystem`, which is greppable and reviewed.
- Better Auth's own tables (`user`, `session`, `member`, `organization` …) are not tenant tables. Queries on them always filter by the signed-in user.

**Consequences.** Every new tenant table needs a policy in a custom migration (`pnpm --filter @zfunnel/db exec drizzle-kit generate --custom`) and a test in `rls.test.ts`. CI runs these tests against real Postgres.

### ADR-008 — Organization = billing/team account, workspace = brand · **Accepted** · 2026-10-10

**Decision.**

- A Better Auth _organization_ is the paying account and holds team membership.
- _Workspaces_ (our table) are brands inside it, each with a platform-unique slug that doubles as its free subdomain.
- In Phase 0, every org member can see every workspace in that org. Per-workspace access is added when a customer needs it.

### ADR-009 — Dependency hygiene · **Accepted** · 2026-10-10

**Decision.**

- Exact version pins.
- pnpm `minimumReleaseAge` of 14 days, so freshly published (possibly compromised) releases are never installed.
- Install scripts are allowed only for esbuild.
- TypeScript stays on 5.9 for now; TypeScript 7 (the Go-based compiler) has not been validated with Next.js 16 here.

### ADR-010 — Self-host on the owner's Oracle Cloud VPS · **Accepted** · 2026-10-10

**Context.** The owner hosts on an Oracle Cloud VPS that already runs other apps. Those apps must not be affected.

**Decision.**

- Everything runs in its own Docker Compose project, `zfunnel`, on its own network. Containers and volumes are prefixed so they can't collide with anything else on the server.
- Inside, there is a Caddy container with **on-demand TLS** for customer domains, which asks the app whether a domain is allowed before issuing a certificate.
- App ports bind to `127.0.0.1` only.
- Before the first deploy, inspect what already holds ports 80 and 443:
  - **If an existing reverse proxy owns them**, ZFunnel's Caddy listens on alternate local ports, and the existing proxy forwards ZFunnel's hostnames to it. Customer custom domains then need TLS passthrough or a dedicated IP, a decision made at deploy time.
  - **If 80 and 443 are free**, ZFunnel's Caddy takes them.
- Oracle's free tier is usually **ARM64 (Ampere)**, so images are built multi-arch.
- Deploy access uses an SSH key provided through the environment's secret settings, never pasted into chat.

**Consequences.** Docker images, a production compose file and a deploy script become part of the repo. File storage can use local disk or Oracle Object Storage (S3-compatible).

### ADR-011 — Built-in test payment gateway · **Accepted** · 2026-10-10

**Decision.** `PAYMENTS_TEST_MODE=true` enables a fake gateway (card 4242…) when a workspace has no live Stripe account. Orders made this way are flagged `test`.

**Why.** Users can rehearse a funnel before connecting Stripe, and CI runs the whole money path without keys.

**Guardrail.** Never enable this in production for real customers. Workspaces with Stripe connected always use Stripe.

### ADR-012 — Cookieless analytics · **Accepted** · 2026-10-10

**Decision.** A visitor is a daily-rotating SHA-256 of (salt, workspace, IP, user agent). We store no cookies, no IPs, and only the referrer's host.

**Consequences.** This is GDPR-friendly and needs no consent banner for funnel stats. Unique visitors are counted per day; people on a shared network and browser count as one visitor.

### ADR-013 — One page per step (for now) · **Accepted** · 2026-10-10

**Decision.** A funnel step stores its draft page directly. Published pages are immutable `page_versions`.

**Consequences.** A/B variants (Phase 2.8) will add a `step_variants` table without breaking existing data.

### ADR-014 — Puck for the email editor, not maily.to · **Accepted** · 2026-10-10

**Decision.** Emails are built with the same Puck editor as pages, using a separate set of email-safe blocks. Each block renders the exact table-based HTML that is sent.

**Why.** One editor to learn and maintain. The preview is the real output, so what users see is what lands in the inbox. maily.to would have added a second editor stack (Tiptap) for little gain.

**Consequences.** Email blocks must stay email-client-safe: tables, inline styles, no scripts. Advanced layouts (multi-column) need dedicated blocks.

### ADR-015 — Automations are a tree, executed by a durable worker · **Accepted** · 2026-10-10

**Decision.** An automation is a trigger plus a tree of steps. Each step has one `next`; conditions have `yes`/`no` branches. Steps are inserted with “+” buttons rather than wired freely. Runs live in Postgres (`workflow_runs`, `workflow_run_logs`). BullMQ only carries wake-ups: start, after a wait, continue.

**Why.** Trees cover welcome series, onboarding, tagging and branching, which is what ClickFunnels workflows do. They can't loop forever, and they're easy to lay out automatically. Keeping state in Postgres means a Redis flush loses at most a pending wake-up, never a contact's position. Each step commits under a row lock, so a retry never repeats a step.

**Consequences.** A contact enters an automation once unless “Allow re-entry” is on; enrollment is idempotent per event. Editing a live automation requires pausing it. Pausing cancels waiting runs when they wake. Deleting a step a contact is waiting on ends that contact's run. Tags added _by_ an automation don't trigger other automations (prevents loops). Webhooks block private and loopback addresses (SSRF).

### ADR-016 — Split tests: sticky cookie assignment, funnel-level conversions · **Accepted** · 2026-10-10

**Decision.** The step itself is variant A. A challenger (`step_variants`) has its own draft and published version and a traffic weight. The renderer picks a version per visitor; the tracker stores the choice in a first-party cookie (`zfv_…`, 30 days) only while a test runs. Only page views record `variant_id`. A visitor counts as converted if, after their first view, the same visitor opts in, buys or takes an upsell anywhere in the funnel (same-day visitor hash). Significance uses a two-proportion z-test, shown once each version has 20 or more visitors.

**Why.** Counting conversions at funnel level credits a sales page for a checkout on the next step, which is what users want to optimize. No attribution plumbing is needed in every API route. The cookie is the minimum needed so a visitor doesn't flip between versions. It holds no personal data.

**Consequences.** One challenger per step for now; the schema allows more. Visitors who clear cookies may be counted in both versions. Declaring B the winner copies B's draft and published version onto the step and deletes the test. Offers attach to the step, so both versions sell the same products.

### ADR-017 — SaaS billing: per-organization plans, soft gates, Stripe Checkout · **Accepted** · 2026-10-10

**Decision.** Plans live in one file (`packages/shared/src/plans.ts`): limits (workspaces, funnels, contacts, emails per month, custom domains, team members) and features (automations, split tests, AI). Every new organization gets a 14-day trial with everything included. Paying uses Stripe Checkout in subscription mode on the platform account. Prices are created from the plan file by lookup key. Changes, cancellations and card updates go through the Stripe Customer Portal. State is kept in `org_billing` via the platform webhook. With `PAYMENTS_TEST_MODE` and no Stripe keys, choosing a plan activates it directly.

**Why.** Billing per organization matches who pays: an agency owns several workspaces. A single `enforce()` gate at the points where resources are created or consumed keeps the rules in one place.

**Consequences.** Gates never block visitors: opt-ins, checkouts and published pages keep working after a trial ends or a limit is reached. Only creating and sending is blocked (new funnels, workspaces, domains, imports, broadcasts, activating automations, split tests, AI), each with a message saying how to upgrade. Automation emails already in flight are not counted against the monthly email limit. **The prices and limits are placeholders for the owner to set.**

### ADR-018 — Affiliates: last-click cookie, commission derived from the order · **Accepted** · 2026-10-10

**Decision.** Any page with `?aff=code` stores `zf_aff=code.timestamp` (last click wins). Checkout credits the affiliate if the program is on, the click falls inside the configured window and the affiliate isn't the buyer. The order stores `affiliate_id`. Commission = percent × (paid − refunded) and is recomputed inside `recomputeOrder` and the refund webhook. Upsells raise it, refunds lower it, and an order that drops to zero voids it. Commissions already marked paid are never changed. Payouts happen outside ZFunnel (PayPal or bank) and are recorded with “Mark paid”.

**Why.** Deriving the commission from the order removes a whole class of drift bugs and needs no extra hooks in the payment paths. Paying affiliates automatically would need Stripe Connect payouts with KYC for each affiliate, which is deferred.

**Consequences.** One affiliate per order (last click). Affiliate codes are random-suffixed, so they can't be guessed from a name. Clicks are counted once per browser session per code.

### ADR-019 — White-label is per workspace; the badge is a paid feature · **Accepted** · 2026-10-10

**Decision.** Logo URL, brand color and “hide Powered by ZFunnel” live on `workspaces`, not on the organization. The logo and color are used on the customer center, courses, store, blog, affiliate portal and the built-in emails (sign-in link, booking confirmation, chat reply). The badge is hidden only when the owner turned it off **and** the organization has an active plan with the `whiteLabel` feature (Pro and Scale). The check runs at render time, in the site resolver.

**Why.** A workspace is the brand customers see. An agency runs one organization with many client brands, so organization-level branding would be wrong for them. Checking the plan at render time means a downgrade brings the badge back without a migration or a webhook hook.

**Consequences.** The dashboard itself stays ZFunnel-branded. A fully white-labeled dashboard on an agency's own domain is deferred. Logos are https links for now; uploads come with the media library. Branding changes reach public pages within the resolver's 5-second cache.

### ADR-020 — Analytics stays on Postgres for now · **Accepted** · 2026-10-10

**Decision.** Page views, opt-ins and sales remain rows in the `events` table, read with indexed aggregate queries (`workspace_id, funnel_id, created_at`; `step_id, type`; `step_id, variant_id, created_at`). We do not add ClickHouse or another OLAP store yet.

**Why.** One Postgres instance on the VPS is simpler to run, back up and secure (RLS applies to analytics too). At the expected early volume (millions of events per month), these queries stay well under a second. A second database would double the operational load before it pays off.

**Consequences.** Triggers to revisit, whichever comes first: (1) `events` passes about 50 million rows; (2) the funnel analytics page's p95 exceeds 1 second. The first step is then monthly range partitioning of `events` on `created_at`, which the indexes already lead with, plus a daily rollup table. ClickHouse comes only after that. Raw events older than 13 months may then be dropped once they are rolled up.

### ADR-021 — Server-side conversions: hashed, deduplicated, kept out of webhooks · **Accepted** · 2026-10-10

**Decision.** Opt-ins and purchases fan out from the worker's workflow-events stream to Meta Conversions API, TikTok Events API and GA4 Measurement Protocol. Each workspace connects these under Settings → Tracking, and tokens are sealed. Email, phone and contact id are SHA-256 hashed before they are stored or sent. Visitor context (IP, user agent, page, `_fbp`/`_fbc`/`_ttp`, `ttclid`, `_ga` client id) travels in a separate `ctx` field on the event, so it never reaches customer webhooks. Event ids are deterministic: `order-<id>` for the checkout, `upsell-<order>-<product>` for one-click upsells, `lead-<job>` for opt-ins. One delivery row per (platform, event id) makes retries and duplicate events safe. The checkout value covers main plus bumps; each upsell is its own Purchase.

**Why.** Browser pixels lose a large share of conversions to ad blockers and iOS privacy features. Sending from the server recovers them. Deterministic ids let a browser pixel that sends the same `event_id` (for example, the order id) deduplicate against ours. Google Ads' own API needs OAuth plus a developer token approved by Google. GA4 conversions can be imported into Google Ads, so GA4 covers it.

**Consequences.** 4xx answers fail immediately (bad token or pixel), while 5xx and network errors retry 5 times with backoff. The latest 25 deliveries show in Settings → Tracking. `?fbclid` and `?ttclid` on any landing page are kept in first-party cookies (90 and 30 days). The API base URLs can be overridden by environment variables for testing only.

### ADR-022 — Webinars: simulated live from a hosted video, no media server · **Accepted** · 2026-10-10

**Decision.** A webinar plays a video hosted elsewhere (YouTube, Vimeo or an https .mp4/.webm). Evergreen sessions are computed from the schedule in the webinar's timezone and are never stored. Only registrations are stored, each with its exact `session_at` and a secret watch token. During the session the room plays from `now − session_at` without controls, so it behaves like a live broadcast. After the session, a replay with controls is available for `replay_hours`. A one-time "live" webinar embeds the real stream and never seeks. Reminder emails are BullMQ jobs delayed until 24 hours and 1 hour before the session. The worker skips a reminder whose session already started.

**Why.** There is no SFU, TURN server or recording pipeline to run on a VPS shared with other apps (Phase 5 addendum). Video hosts already handle bandwidth and adaptive streaming. Computing sessions on the fly means schedule edits apply at once and no sessions table needs cleanup.

**Consequences.** If Redis is flushed, pending reminders are lost; the confirmation email always carries the watch link. Viewers can see YouTube/Vimeo branding unless the owner uses an .mp4. There is no interactive chat in the room yet; the site chat widget still works on the page. Attendance counts the first join during the live window or the replay window, and only the first one triggers `webinar_attended`.

### ADR-023 — Native Arabic: typed dictionaries, two language settings, Western digits · **Accepted** · 2026-10-10

**Decision.** Built in-house in `@zfunnel/i18n`, with no third-party i18n library.

- English dictionaries are the source of truth. The Arabic ones are typed against their shape, so a missing translation fails the build. Plurals use `Intl.PluralRules`.
- **Two separate languages.**
  - The dashboard follows the _user_ (cookie, else Accept-Language).
  - Public pages, checkout, customer emails and API errors follow the _workspace's site language_.
  - Blocks get the site language through their runtime, so the editor shows the page in the site's language and direction even when the dashboard is in English.
- **Western digits** (`ar-u-nu-latn`) for all Arabic formatting.
- **Arabic calendars** start the week on Sunday.
- **Copy is written natively** using a shared glossary (`docs/ARABIC.md`).
- **Not translated:** content the user writes, and the Puck editor's own chrome.

**Why.** A merchant's language and their customers' language differ often, for example an English-speaking agency running an Arabic store. One setting can't serve both. Typed dictionaries make "no English left behind" a compile-time guarantee instead of a hope. Western digits match card numbers and phone inputs and are standard in Gulf marketing.

**Consequences.**

- Both dictionaries ship to the browser (tens of KB).
- Visitor-facing server errors are `errors.*` keys, translated at response time. Payment-provider messages are passed through as is.
- Email clients don't support logical CSS, so right-to-left emails mirror left/right alignment in the rendered HTML.
- Adding a third language means one more dictionary file per namespace.
