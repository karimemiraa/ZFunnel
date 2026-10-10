# Open-Source Repo Research

> Checked 2026-10-10 using GitHub repository metadata. When GitHub reported the license as `NOASSERTION`, we read the LICENSE file itself.
> Proprietary SaaS needs permissive code. **✅ Embed**: MIT, Apache-2.0, BSD, ISC. **⚠️ Reference only**: AGPL, GPL, SSPL, BSL, FSL, Sustainable Use, no license, or `ee/` folders.

## How we use other people's code

| Mode               | Meaning                                                                       | Allowed licenses                                       |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Dependency**     | Install from npm and keep upgrading                                           | ✅ only                                                |
| **Vendor/harvest** | Copy specific files or algorithms into our repo, keeping their LICENSE header | ✅ only                                                |
| **Sidecar**        | Run their app unmodified as a separate service and talk to it over its API    | ✅, or ⚠️ after an explicit decision in `DECISIONS.md` |
| **Reference**      | Read it to learn data models and UX; write our own code                       | Any                                                    |

**Why we don't fork one big app.** No open-source ClickFunnels clone is mature enough:

- The closest is `autonnel/autonnel`: Apache-2.0, Astro, 24 stars.
- Stitching together whole apps written in Go, PHP, Ruby and Elixir would leave us with 6+ deployments, 6+ databases and 6+ auth systems.

So the plan is **one TypeScript monorepo** that pulls in mature permissive _libraries_ for the hard parts (editor, canvas, email rendering, queues, auth, UI) and harvests code from MIT apps.

---

## Selected stack: what we take, and from where

| Capability                     | Pick                                                                                                                                         | License    | ⭐            | Mode                   | What we take                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------- | ---------------------- | ------------------------------------------------------------------------- |
| Page/funnel editor             | [puckeditor/puck](https://github.com/puckeditor/puck)                                                                                        | MIT        | 13.4k         | Dependency             | Drag-and-drop editor. Saves JSON, renders natively in React/Next.js.      |
| Inline text editing            | [ueberdosis/tiptap](https://github.com/ueberdosis/tiptap)                                                                                    | MIT        | 38.7k         | Dependency             | Rich text inside headline/paragraph blocks. Free extensions only.         |
| Funnel map + automation canvas | [xyflow/xyflow](https://github.com/xyflow/xyflow) (React Flow)                                                                               | MIT        | 38.6k         | Dependency             | Node-graph UI for funnel steps and workflow builder                       |
| UI kit                         | [shadcn-ui/ui](https://github.com/shadcn-ui/ui)                                                                                              | MIT        | 125k          | Vendor                 | All dashboard components                                                  |
| App shell seed                 | [nextjs/saas-starter](https://github.com/nextjs/saas-starter)                                                                                | MIT        | 16.2k         | Vendor                 | Next.js + Postgres/Drizzle + Stripe + shadcn skeleton                     |
| Auth + orgs/roles              | [better-auth/better-auth](https://github.com/better-auth/better-auth)                                                                        | MIT        | 30.2k         | Dependency             | Email/password, OAuth, magic link, organizations, roles                   |
| Job queue / delays             | [taskforcesh/bullmq](https://github.com/taskforcesh/bullmq)                                                                                  | MIT        | 9.5k          | Dependency             | Email sends, workflow waits, retries, webhooks                            |
| Email rendering                | [resend/react-email](https://github.com/resend/react-email) + [mjmlio/mjml](https://github.com/mjmlio/mjml)                                  | MIT        | 19.8k / 18.3k | Dependency             | Responsive email HTML                                                     |
| Email visual editor            | [arikchakma/maily.to](https://github.com/arikchakma/maily.to) (alt: [zalify/easy-email-editor](https://github.com/zalify/easy-email-editor)) | MIT        | 4.0k / 3.0k   | Dependency             | Block email editor on Tiptap + shadcn, so it shares the same editing feel |
| Email/journey reference        | [dittofeed/dittofeed](https://github.com/dittofeed/dittofeed)                                                                                | MIT        | 3.0k          | Harvest                | Segments, journeys, broadcast data model                                  |
| CRM                            | [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm)                                                                                | MIT        | 1.4k          | Harvest                | Contacts, deals kanban, notes, same React/shadcn stack                    |
| Analytics                      | [umami-software/umami](https://github.com/umami-software/umami)                                                                              | MIT        | 39.3k         | Harvest                | Tracker script, event schema, aggregation queries (Postgres → ClickHouse) |
| A/B testing                    | [growthbook/growthbook](https://github.com/growthbook/growthbook) core (avoid `enterprise/` folders)                                         | MIT        | 8.5k          | Reference/harvest      | Hashing-based variant assignment, Bayesian stats approach                 |
| Booking/calendars              | [calcom/cal.diy](https://github.com/calcom/cal.diy)                                                                                          | MIT        | 48.9k         | Harvest                | Availability/slot computation, Google/Outlook calendar sync               |
| AI                             | [vercel/ai](https://github.com/vercel/ai)                                                                                                    | Apache-2.0 | 27.2k         | Dependency             | Streaming LLM calls (Claude) for copy, funnel and email generation        |
| Notifications / SMS            | [novuhq/novu](https://github.com/novuhq/novu) (avoid `/enterprise`)                                                                          | MIT        | 40.1k         | Sidecar or reference   | SMS, push, in-app inbox (Phase 3+)                                        |
| Integrations library           | [activepieces/activepieces](https://github.com/activepieces/activepieces) (avoid `ee/`)                                                      | MIT        | 25.0k         | Harvest                | Pre-built "pieces" for 3rd-party app actions in workflows                 |
| Live webinars                  | [livekit/livekit](https://github.com/livekit/livekit) + [livekit/components-js](https://github.com/livekit/components-js)                    | Apache-2.0 | 21.4k         | Sidecar + Dependency   | WebRTC live rooms (Phase 5)                                               |
| Custom-domain TLS              | [caddyserver/caddy](https://github.com/caddyserver/caddy)                                                                                    | Apache-2.0 | 77.7k         | Sidecar                | On-demand TLS certificates for customer domains (if self-hosted)          |
| Mail server (optional)         | [postalserver/postal](https://github.com/postalserver/postal)                                                                                | MIT        | 16.9k         | Sidecar                | Self-hosted sending if we don't use SES/Resend                            |
| Payments                       | Stripe API + [stripe-samples/accept-a-payment](https://github.com/stripe-samples/accept-a-payment)                                           | MIT        | —             | Dependency + Reference | Payment Element, saved cards for one-click upsells, Connect               |
| Funnel domain model            | [autonnel/autonnel](https://github.com/autonnel/autonnel)                                                                                    | Apache-2.0 | 24            | Reference              | Order bumps, upsells, funnel A/B and postback data model                  |

### Evaluated but not chosen

| Repo                                                    | License             | Why not                                                                                                                        |
| ------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| GrapesJS/grapesjs (26.3k)                               | BSD-3 ✅            | Mature, but outputs HTML/CSS strings rather than typed React components. **Fallback editor** if Puck falls short.              |
| prevwong/craft.js (8.8k)                                | MIT ✅              | Last push Feb 2025; maintenance risk                                                                                           |
| plasmicapp/plasmic (7.1k)                               | MIT ✅              | Huge platform; would take over our architecture                                                                                |
| BuilderIO/builder                                       | MIT (SDK only)      | The editor itself is their hosted SaaS                                                                                         |
| onlook-dev/onlook (26.9k)                               | Apache ✅           | Developer-facing code editor, not a builder for end users                                                                      |
| chaibuilder/core (483)                                  | BSD-3 ✅            | Small community; worth watching                                                                                                |
| webstudio-is/webstudio, silexlabs/Silex, easyblocks     | AGPL ⚠️             | License                                                                                                                        |
| medusajs/medusa (36.7k)                                 | MIT (outside EE) ✅ | Overkill for funnels. **Reconsider for Phase 4 store** if catalog needs grow.                                                  |
| vendurehq/vendure                                       | GPLv3 ⚠️            | License                                                                                                                        |
| getlago/lago, dubinc/dub                                | AGPL ⚠️             | License (Dub is still a good reference for affiliate and custom-domain UX)                                                     |
| vercel/platforms (6.7k)                                 | **No license** ⚠️   | All rights reserved. We reimplement the subdomain-routing _pattern_ ourselves.                                                 |
| knadh/listmonk, useplunk/plunk, pentacent/keila, mautic | AGPL/GPL ⚠️         | License (good email UX references)                                                                                             |
| n8n-io/n8n (207k)                                       | Sustainable Use ⚠️  | Prohibits offering it as part of a competing paid service                                                                      |
| inngest/inngest                                         | SSPL ⚠️             | License                                                                                                                        |
| windmill, notifuse, laudspeaker                         | AGPL/BSL ⚠️         | License                                                                                                                        |
| trigger.dev (16.5k)                                     | Apache ✅           | Good, but adds a separate platform. BullMQ is enough to start. **Revisit** if workflows get complex.                           |
| temporalio/temporal                                     | MIT ✅              | Too heavy to operate for our size                                                                                              |
| twentyhq/twenty (58k)                                   | AGPL core ⚠️        | License (its `twenty-ui` package is MIT and usable)                                                                            |
| formbricks, heyform, OpnForm                            | AGPL ⚠️             | License                                                                                                                        |
| baptisteArno/typebot.io                                 | FSL ⚠️              | Explicitly bans competing use                                                                                                  |
| courselit, classroomio, frappe/lms, openedx, moodle     | AGPL/GPL ⚠️         | License. **Courses get built in-house**, using these as UX reference.                                                          |
| discourse, forem, NodeBB                                | GPL/AGPL ⚠️         | License. **Community gets built in-house.** apache/answer (Apache) is the reference.                                           |
| Refferq/Refferq (130)                                   | MIT ✅              | Too young. **Affiliate gets built in-house**; Refferq and Dub are references.                                                  |
| plausible, openpanel, rybbit, unleash                   | AGPL ⚠️             | License. Umami (MIT) covers this.                                                                                              |
| PostHog                                                 | MIT + `ee/`         | Could run as hosted product analytics for _our_ SaaS, not for customer funnels                                                 |
| payloadcms/payload (45k), TryGhost/Ghost (55k)          | MIT ✅              | Both are full CMS apps. The blog is just another page type in our Puck editor. Payload is optional for our own marketing site. |
| juspay/hyperswitch                                      | Apache ✅           | Payment orchestration; too heavy for v1                                                                                        |
| evolution-api                                           | Modified Apache ⚠️  | Has extra branding conditions                                                                                                  |

## Gaps with no permissive open-source project, so we build them in-house

1. **One-click upsell engine.** Stripe off-session charges plus our own funnel session state.
2. **Courses / memberships.** All the TypeScript LMS projects are AGPL.
3. **Community.**
4. **Affiliate center.**
5. **Funnel-step analytics** on top of the Umami-style event store.

## License enforcement

CI runs a license check (e.g. `license-checker-rseidelsohn --onlyAllow "MIT;Apache-2.0;BSD-2-Clause;BSD-3-Clause;ISC;0BSD;CC0-1.0;BlueOak-1.0.0;Python-2.0"`). Any new dependency outside that list fails the build.

Harvested files keep their original copyright header and are listed in `THIRD_PARTY_NOTICES.md`.
