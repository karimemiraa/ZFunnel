# ZFunnel

An all-in-one funnel platform: drag-and-drop pages, sales funnels, checkout with order bumps and one-click upsells, CRM, email, automations, courses, appointments, analytics and AI. Its goal is full ClickFunnels 2.0 parity and more.

> **Status: planning.** No application code yet. The plan is awaiting sign-off.

## Planning documents

| Doc | What's inside |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Problem, users, success criteria, ClickFunnels parity matrix, scope, constraints, risks, **open questions** |
| [docs/REPO_RESEARCH.md](docs/REPO_RESEARCH.md) | Verified open-source repos (license, stars, activity), what we take from each, and what we avoid |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, tech stack, **project structure**, data model, upsell flow, security |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Phase-by-phase build plan with acceptance tests |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architecture decision log |

## Planned stack

TypeScript · Next.js · Turborepo/pnpm · PostgreSQL + Drizzle (RLS) · Redis + BullMQ · Better Auth · Puck + Tiptap (editor) · React Flow (funnel map and automations) · shadcn/ui · Stripe Connect · react-email/MJML · Vercel AI SDK (Claude)
