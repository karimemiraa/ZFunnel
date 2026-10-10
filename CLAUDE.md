# ZFunnel: notes for AI assistants and contributors

Read `docs/PRD.md`, `docs/ROADMAP.md` and `docs/DECISIONS.md` before starting work. The owner works PRD-first: write the plan, raise open questions, and get sign-off before building each phase.

## Rules that must not be broken

- **Licenses (ADR-002):** paid proprietary SaaS. Only MIT/Apache/BSD/ISC code may be added or copied. `pnpm check:licenses` must pass. Record copied code in `THIRD_PARTY_NOTICES.md`.
- **Tenant isolation (ADR-007):**
  - Access tenant tables only through `withOrganization` / `withWorkspace` from `@zfunnel/db`.
  - `withSystem` is for trusted cross-tenant platform code only.
  - Every new tenant table needs an RLS policy in a custom migration and a test in `packages/db/src/rls.test.ts`.
- **Dependencies (ADR-009):** pin exact versions. Never install anything published less than 14 days ago (pnpm enforces this).
- Never commit `.env`. Card data never touches our servers.

## Before pushing

`pnpm format && pnpm check:licenses && pnpm lint && pnpm typecheck && pnpm test && pnpm build`

The RLS tests need `TEST_DATABASE_URL`, pointing at a database owned by a non-superuser role (see `infra/docker/postgres-init.sql`).

## Docs

Update `docs/` in the same change as the code. Log architectural choices as ADRs in `docs/DECISIONS.md`.
