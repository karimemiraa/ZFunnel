# Decision Log (ADRs)

Format: **ID — Title** · Status (Proposed / Accepted / Superseded) · Date. Short context, decision, consequences.

---

### ADR-001 — Compose from libraries, don't fork a whole app · Proposed · 2026-10-10
**Context.** No open-source ClickFunnels clone is mature enough. The best match, autonnel, has 24 stars and is built on Astro. Combining full apps (Listmonk/Go, Mautic/PHP, Discourse/Ruby, Plausible/Elixir) would mean many stacks, databases and auth systems.
**Decision.** Build a single TypeScript monorepo. Use mature permissive libraries (Puck, Tiptap, React Flow, BullMQ, Better Auth, react-email, shadcn) and harvest code from MIT apps (Umami, atomic-crm, cal.diy, dittofeed). Run separate services only for infrastructure (Caddy, LiveKit, optional Postal).
**Consequences.** We write the funnel, checkout, upsell, course, community and affiliate logic ourselves, but on proven foundations. There is one deployment model and one data model.

### ADR-002 — Permissive licenses only in the core · Proposed · 2026-10-10
**Context.** The core is meant to stay proprietary (pending PRD Q1). AGPL, GPL, SSPL, FSL and Sustainable Use code would force us to open-source it or would breach its license terms.
**Decision.** Embed only MIT, Apache, BSD or ISC code, enforced by a CI license gate. Copyleft projects are design references only.
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
