# ZFunnel

An all-in-one funnel platform: drag-and-drop pages, sales funnels, checkout with order bumps and one-click upsells, CRM, email, automations, courses, appointments, analytics and AI. The goal is full ClickFunnels 2.0 parity and more.

> **Status: Phase 0 (foundation) is built.** It covers accounts, organizations, workspaces with row-level-security tenant isolation, the dashboard shell, the public subdomain renderer and CI. Phase 1 (editor → funnel → checkout → upsell) starts after sign-off. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Quick start

Requirements: Node 22+, pnpm 10, Docker.

```bash
cp .env.example .env            # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
pnpm install
pnpm infra:up                   # Postgres, Redis, Mailpit
pnpm db:migrate
pnpm dev                        # dashboard :3000 · public sites :3001 · worker
```

- Dashboard: http://localhost:3000. Sign up, then create a workspace.
- Published site: `http://<workspace-slug>.localhost:3001`. Browsers resolve `*.localhost` automatically.
- Mailpit: http://localhost:8025

## Repository layout

| Path              | What it is                                                              |
| ----------------- | ----------------------------------------------------------------------- |
| `apps/web`        | Dashboard: auth, onboarding, workspaces, settings, and later the editor |
| `apps/sites`      | Public renderer for `{slug}.zfunnel.app` and custom domains             |
| `apps/worker`     | BullMQ background jobs                                                  |
| `packages/db`     | Drizzle schema, migrations, RLS policies, tenant-scoped query helpers   |
| `packages/auth`   | Better Auth configuration (organizations, roles)                        |
| `packages/ui`     | Design system (shadcn/ui components and theme tokens)                   |
| `packages/shared` | zod schemas and shared utilities                                        |
| `packages/config` | Shared TypeScript and ESLint config                                     |
| `infra/docker`    | Local services                                                          |
| `docs/`           | PRD, architecture, research, roadmap, decision log                      |

## Everyday commands

| Command                                      | Does                                                          |
| -------------------------------------------- | ------------------------------------------------------------- |
| `pnpm dev`                                   | Run all apps                                                  |
| `pnpm build` / `lint` / `typecheck` / `test` | Same checks CI runs                                           |
| `pnpm format`                                | Prettier                                                      |
| `pnpm check:licenses`                        | Fail if any production dependency isn't permissively licensed |
| `pnpm db:generate`                           | Create a migration after changing the schema                  |
| `pnpm db:migrate`                            | Apply migrations                                              |

## Planning documents

| Doc                                            | What's inside                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [docs/PRD.md](docs/PRD.md)                     | Problem, users, success criteria, ClickFunnels parity matrix, scope, risks, open questions |
| [docs/REPO_RESEARCH.md](docs/REPO_RESEARCH.md) | Verified open-source repos and what we take from each                                      |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)   | System design, stack, project structure, data model, tenancy                               |
| [docs/ROADMAP.md](docs/ROADMAP.md)             | Phase-by-phase plan with acceptance tests and status                                       |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)       | Step-by-step production deployment (Oracle VPS, DNS, Stripe, backups)                      |
| [docs/DECISIONS.md](docs/DECISIONS.md)         | Architecture decision log                                                                  |
