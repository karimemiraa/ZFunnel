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

