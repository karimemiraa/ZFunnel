# ZFunnel — Product Requirements Document (PRD)

> Status: **v0.2: Q1 answered (paid SaaS), Phase 0 approved and built.** Each later phase still needs sign-off.
> Owner: Zeal Marketing · Last updated: 2026-10-10

---

## 1. Problem

Marketers, coaches, course creators and small e-commerce brands need one tool to build sales funnels, take payments, run upsells, deliver courses, send email and track results. Today that means ClickFunnels ($97–$297/mo, per-workspace limits on contacts, emails, domains, stores and courses), or stitching together 6–10 separate SaaS tools.

ZFunnel is a self-owned, multi-tenant funnel platform covering everything ClickFunnels 2.0 does. It is built by combining proven open-source components rather than writing every subsystem from scratch, and it adds capabilities ClickFunnels lacks or charges extra for.

## 2. Target users

| Persona                         | Primary jobs                                                   |
| ------------------------------- | -------------------------------------------------------------- |
| **Funnel builder / marketer**   | Build pages and funnels, run A/B tests, track conversions      |
| **Info-product seller / coach** | Sell courses, memberships, communities and appointments        |
| **E-commerce operator**         | Run stores, 2-step checkout, order bumps, one-click upsells    |
| **Agency**                      | Manage many client workspaces, white-label, reuse templates    |
| **End customer (of our users)** | Buy, log into the customer center, consume courses, book calls |

## 3. Success criteria

The MVP is done when **a non-technical user can, in under 30 minutes and without docs:**

1. Sign up, create a workspace and connect a custom domain (SSL issued automatically).
2. Pick a template, then edit an opt-in page → sales page → checkout → upsell → thank-you funnel in the drag-and-drop editor.
3. Connect Stripe, sell a product with an order bump, and accept a **one-click upsell** that charges without re-entering the card.
4. Have the buyer land in a CRM contact record, receive an automated email sequence and get access to a course.
5. See visits, opt-ins, sales and revenue per funnel step, with an A/B split on one page.

Non-functional targets:

- Published pages: **LCP < 1.5s** on 4G, Lighthouse performance ≥ 90 (static or edge-cached HTML, no editor JS on live pages).
- Checkout: PCI scope limited to SAQ-A (card data only ever touches Stripe/PayPal elements).
- Tenant isolation: every DB query is scoped by `workspace_id`, enforced by row-level security.
- 99.9% uptime for published pages, which stay served even if the app/editor is down.

## 4. Feature parity matrix (ClickFunnels 2.0 → ZFunnel)

Source: the official [ClickFunnels pricing page](https://www.clickfunnels.com/pricing), checked 2026-10-10, plus third-party reviews. "+" marks where ZFunnel goes beyond ClickFunnels.

| #   | Area                              | ClickFunnels 2.0                                                          | ZFunnel plan                                                                                                                                                           | Phase |
| --- | --------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 1   | **Page editor**                   | Drag-and-drop, sections/rows/columns/elements, custom code (higher tiers) | Visual editor with sections, rows, columns and elements, responsive per-breakpoint styles, global styles/colors/fonts, saved blocks and custom code on all plans **+** | 1     |
| 2   | **Funnels**                       | Sales, store, countdown and survey funnels; funnel steps; templates       | Visual funnel map (steps as nodes), step types, templates, share-funnel links, import/export JSON **+**                                                                | 1     |
| 3   | **Websites & blog**               | Site pages, navigation, blog                                              | Multi-page sites, menus, blog with SEO fields, RSS and sitemap                                                                                                         | 3     |
| 4   | **Hosting & domains**             | Edge hosting, custom domains, free subdomain                              | `*.zfunnel.app` subdomains, custom domains with on-demand SSL, edge-cached HTML                                                                                        | 1     |
| 5   | **Products & checkout**           | Smart Checkout, 1- and 2-step, order bumps, Global Products, discounts    | Products and prices (one-time, subscription, payment plans, trials), 1- and 2-step checkout, order bumps, coupons, taxes                                               | 1     |
| 6   | **One-click upsells/downsells**   | Yes                                                                       | Stripe off-session charge with saved PaymentMethod; also PayPal vaulting **+**                                                                                         | 1     |
| 7   | **Payments**                      | Stripe, PayPal, NMI and more                                              | Stripe first, then PayPal; payment gateway adapter interface for more                                                                                                  | 1 → 2 |
| 8   | **E-commerce store**              | Store, catalog, cart, shipping                                            | Catalog, variants, cart, shipping rates, inventory, physical fulfillment                                                                                               | 4     |
| 9   | **Customer center**               | Orders, subscriptions, access                                             | Orders, invoices, subscription self-service (cancel/upgrade), course access                                                                                            | 2     |
| 10  | **CRM & contacts**                | Contacts, tags, pipelines, opportunities                                  | Contacts, tags, custom fields, segments, kanban pipelines, opportunities, activity timeline                                                                            | 2     |
| 11  | **Email marketing**               | Broadcasts, sequences, A/B, dedicated IP                                  | Drag-and-drop email editor, broadcasts, sequences, A/B subject lines, deliverability tooling, bring-your-own SES/SMTP/Resend **+**                                     | 2     |
| 12  | **Workflows/automations**         | Triggers → actions                                                        | Visual node-based automation builder (triggers, waits, if/else branches, webhooks), with versioned runs and logs **+**                                                 | 2     |
| 13  | **Courses**                       | Courses, modules, lessons, drip                                           | Courses, modules, lessons, drip, video hosting, progress, quizzes and certificates **+** (CF lacks quizzes)                                                            | 3     |
| 14  | **Memberships**                   | Membership sites                                                          | Access bundles tied to products/subscriptions                                                                                                                          | 3     |
| 15  | **Community**                     | Community                                                                 | Spaces, posts, comments, reactions, notifications                                                                                                                      | 4     |
| 16  | **Appointments**                  | Calendars                                                                 | Booking pages, availability, Google/Outlook sync, paid bookings                                                                                                        | 3     |
| 17  | **Forms & surveys**               | Survey funnels, forms                                                     | Form/quiz/survey elements, conditional logic, quiz-to-offer routing                                                                                                    | 2     |
| 18  | **A/B testing**                   | Funnel pages and email                                                    | Page split tests with stats significance, multi-variant **+**, email A/B                                                                                               | 2     |
| 19  | **Analytics**                     | Funnel analytics                                                          | Per-step conversion, revenue, EPC, UTM attribution, cohort LTV **+**, cookieless mode **+**                                                                            | 1 → 2 |
| 20  | **Affiliate center**              | Backpack/Affiliate Center                                                 | Affiliate signup, links, commission rules (multi-tier), payouts report                                                                                                 | 4     |
| 21  | **Message Hub / chat**            | Message Hub agents                                                        | Unified inbox (email, site chat, SMS/WhatsApp later)                                                                                                                   | 4     |
| 22  | **SMS**                           | Limited                                                                   | Twilio SMS in workflows **+**                                                                                                                                          | 3     |
| 23  | **AI**                            | AI funnel builder, copy, coaching                                         | AI funnel generator (prompt → full funnel), copy rewrite in editor, AI email writer, image generation **+**                                                            | 2 → 3 |
| 24  | **Workspaces & team**             | Workspaces, team seats                                                    | Organizations → workspaces, roles/permissions, audit log                                                                                                               | 1     |
| 25  | **API & webhooks**                | API, webhooks (higher tiers)                                              | Public REST API and outbound webhooks on all plans **+**, plus Zapier/Make apps                                                                                        | 3     |
| 26  | **Agency / white-label**          | Limited (branding removal)                                                | Full white-label: custom app domain, logo and email sender; client sub-accounts **+**                                                                                  | 4     |
| 27  | **Templates marketplace**         | Templates, shared funnels                                                 | Template gallery, user-shareable funnels, paid template marketplace **+**                                                                                              | 4     |
| 28  | **Webinars**                      | Not in CF 2.0                                                             | Evergreen and live webinar funnels **+**                                                                                                                               | 5     |
| 29  | **SaaS billing (us → our users)** | n/a                                                                       | Plans, usage limits and metering for ZFunnel's own subscriptions                                                                                                       | 2     |

## 5. Scope

### In scope for MVP (Phase 1)

Rows 1, 2, 4, 5, 6, 7 (Stripe only), 19 (basic), 24, plus auth, templates (10 starter funnels) and the basic contacts list needed to capture opt-ins.

### Explicitly out of scope for MVP

Everything else in §4. Each later phase is a separate sign-off.

### Never in scope (without a new decision)

- Forking whole third-party apps into our codebase (see `ARCHITECTURE.md` §2: we adopt **libraries**, not apps).
- Embedding code under AGPL/GPL, Sustainable Use, FSL or other non-permissive licenses into the proprietary core (see `REPO_RESEARCH.md`).

## 6. Constraints

- **Licensing:** the core must stay proprietary-safe. Only MIT, Apache-2.0, BSD and ISC code may be embedded. AGPL tools may only run as separate, unmodified services, and only if the decision is logged.
- **Single stack:** TypeScript end-to-end. A patchwork of PHP, Elixir, Go and Ruby apps would be unmaintainable for a small team.
- **PCI:** no raw card data on our servers, ever.
- **Email deliverability:** sending must be per-tenant isolated (sub-accounts or dedicated domains) so one spammer can't burn everyone's reputation.
- **GDPR/DSGVO:** EU data residency option, consent logging, export/delete per contact. This matters because Zeal Marketing operates in Germany.

## 7. Risks

| Risk                                        | Impact                 | Mitigation                                                        |
| ------------------------------------------- | ---------------------- | ----------------------------------------------------------------- |
| "100% parity" scope is roughly 25+ products | Never ships            | Phased roadmap; MVP = funnel → checkout → upsell loop only        |
| Editor quality is make-or-break for UX      | Users churn            | Build on a mature editor engine; budget the most time here        |
| Combining many repos with different stacks  | Maintenance hell       | Adopt libraries in one TS monorepo; sidecars only where justified |
| License contamination (AGPL)                | Forced open-sourcing   | License gate in CI (`license-checker`), decision log              |
| Email abuse                                 | Shared IP blacklisting | Per-tenant sending domains, warmup, sending limits, abuse review  |
| Payment disputes on one-click upsells       | Stripe account risk    | Clear upsell disclosure, SCA/3DS handling, refund tooling         |

## 8. Build plan (summary)

See [`ROADMAP.md`](./ROADMAP.md) for the step-by-step plan with deliverables and acceptance tests per step.

## 9. Open questions (need answers before building)

1. ~~**Business model**~~ **Answered 2026-10-10: paid, proprietary SaaS.** AGPL/GPL components can only be design references (ADR-002).
2. **Hosting:** Vercel plus managed services (fastest to ship, higher cost at scale), or self-hosted on Hetzner or another EU VPS with Docker (cheaper, more ops work)? Is EU data residency required?
3. **Payments:** Stripe first, then PayPal. Do you also need other gateways (e.g. Klarna, SEPA, NMI, Mollie, Paddle)?
4. **Email sending:** Amazon SES (cheapest), Resend or Postmark (simplest), or self-hosted Postal?
5. **Languages:** English only for MVP, or German and Arabic (RTL) from day one?
6. **Team and timeline:** Who is building alongside Claude, and is there a target launch date? This sets how aggressive Phase 1 can be.
7. **Brand:** Is "ZFunnel" the final product name, and is there a logo, color palette or domain already?
