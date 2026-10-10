import "server-only";

import type { PageData } from "@zfunnel/blocks";
import { PLANS } from "@zfunnel/shared";
import {
  and,
  asc,
  domains,
  eq,
  funnels,
  funnelSteps,
  getDb,
  gt,
  isNull,
  orgBilling,
  pageVersions,
  sql,
  stepVariants,
  withSystem,
  workspaces,
} from "@zfunnel/db";

/**
 * Public lookups. The renderer has no user session, so it uses the trusted system
 * context and only ever reads published snapshots.
 */
export type SiteWorkspace = {
  id: string;
  name: string;
  slug: string;
  homeFunnelId: string | null;
  logoUrl: string | null;
  brandColor: string;
  /** False only when the owner hid it AND the plan includes white-label. */
  showBadge: boolean;
};

const WHITE_LABEL_PLANS = Object.values(PLANS)
  .filter((p) => p.features.whiteLabel)
  .map((p) => p.id);

/** Branding columns shared by both workspace lookups. */
const brandColumns = {
  logoUrl: workspaces.logoUrl,
  brandColor: workspaces.brandColor,
  showBadge: sql<boolean>`not (${workspaces.hideBadge} and exists (
    select 1 from ${orgBilling} b where b.organization_id = ${workspaces.organizationId}
      and b.status in ('active', 'trialing', 'past_due')
      and b.plan in (${sql.join(
        WHITE_LABEL_PLANS.map((id) => sql`${id}`),
        sql`, `,
      )})))`,
};
export type ResolvedPage = {
  workspace: SiteWorkspace;
  funnel: { id: string; slug: string; name: string };
  step: { id: string; slug: string; name: string; type: string };
  data: PageData;
  /** Published split-test challengers (the step itself is variant A). */
  variants: { id: string; weight: number; data: PageData }[];
  nextPath: string | null;
  declinePath: string | null;
};

const TTL_MS = 5_000;
const cache = new Map<string, { at: number; value: unknown }>();

/** Tiny in-process cache: published pages change rarely, and a publish shows up within TTL_MS. */
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 5_000) cache.delete(cache.keys().next().value!);
  return value;
}

export function resolveWorkspace(slug: string) {
  return cached(`ws:${slug}`, async () => {
    const [row] = await withSystem(getDb(), (tx) =>
      tx
        .select({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
          homeFunnelId: workspaces.homeFunnelId,
          ...brandColumns,
        })
        .from(workspaces)
        .where(eq(workspaces.slug, slug))
        .limit(1),
    );
    return (row ?? null) as SiteWorkspace | null;
  });
}

/** Workspace for an active custom domain; the domain may pick its own homepage funnel. */
export function resolveCustomDomain(hostname: string) {
  return cached(`dom:${hostname}`, async () => {
    const [row] = await withSystem(getDb(), (tx) =>
      tx
        .select({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
          homeFunnelId: workspaces.homeFunnelId,
          domainFunnelId: domains.funnelId,
          ...brandColumns,
        })
        .from(domains)
        .innerJoin(workspaces, eq(workspaces.id, domains.workspaceId))
        .where(and(eq(domains.hostname, hostname), eq(domains.status, "active")))
        .limit(1),
    );
    if (!row) return null;
    const { domainFunnelId, ...ws } = row;
    return { ...ws, homeFunnelId: domainFunnelId ?? ws.homeFunnelId } as SiteWorkspace;
  });
}

/** Resolves "/", "/{funnel}" or "/{funnel}/{step}" to a published page. */
export function resolvePage(ws: SiteWorkspace, segments: string[]): Promise<ResolvedPage | null> {
  if (segments.length > 2 || segments.some((s) => !/^[a-z0-9-]{1,64}$/.test(s))) return Promise.resolve(null);
  return cached(`page:${ws.id}:${segments.join("/")}`, () =>
    withSystem(getDb(), async (tx) => {
      const funnelWhere =
        segments.length === 0
          ? ws.homeFunnelId
            ? eq(funnels.id, ws.homeFunnelId)
            : null
          : eq(funnels.slug, segments[0]!);
      if (!funnelWhere) return null;
      const [funnel] = await tx
        .select({ id: funnels.id, slug: funnels.slug, name: funnels.name })
        .from(funnels)
        .where(and(eq(funnels.workspaceId, ws.id), funnelWhere, isNull(funnels.archivedAt)))
        .limit(1);
      if (!funnel) return null;

      const steps = await tx
        .select({
          id: funnelSteps.id,
          slug: funnelSteps.slug,
          name: funnelSteps.name,
          type: funnelSteps.type,
          nextStepId: funnelSteps.nextStepId,
          declineStepId: funnelSteps.declineStepId,
          publishedVersionId: funnelSteps.publishedVersionId,
        })
        .from(funnelSteps)
        .where(eq(funnelSteps.funnelId, funnel.id))
        .orderBy(asc(funnelSteps.position));
      const step = segments[1] ? steps.find((s) => s.slug === segments[1]) : steps[0];
      if (!step?.publishedVersionId) return null;

      const [version] = await tx
        .select({ data: pageVersions.data })
        .from(pageVersions)
        .where(eq(pageVersions.id, step.publishedVersionId));
      if (!version) return null;

      const variantRows = await tx
        .select({ id: stepVariants.id, weight: stepVariants.weight, data: pageVersions.data })
        .from(stepVariants)
        .innerJoin(pageVersions, eq(pageVersions.id, stepVariants.publishedVersionId))
        .where(and(eq(stepVariants.stepId, step.id), gt(stepVariants.weight, 0)));

      const pathOf = (id: string | null) => {
        const s = id ? steps.find((x) => x.id === id) : undefined;
        return s?.publishedVersionId ? `/${funnel.slug}/${s.slug}` : null;
      };
      return {
        workspace: ws,
        funnel,
        step: { id: step.id, slug: step.slug, name: step.name, type: step.type },
        data: version.data as unknown as PageData,
        variants: variantRows.map((v) => ({ id: v.id, weight: v.weight, data: v.data as unknown as PageData })),
        nextPath: pathOf(step.nextStepId),
        declinePath: pathOf(step.declineStepId),
      } satisfies ResolvedPage;
    }),
  );
}

/** For API routes: the step must belong to the workspace serving this host. */
export async function resolveStepForWorkspace(workspaceId: string, stepId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(stepId)) return null;
  return withSystem(getDb(), async (tx) => {
    const [row] = await tx
      .select({
        id: funnelSteps.id,
        funnelId: funnelSteps.funnelId,
        type: funnelSteps.type,
        nextStepId: funnelSteps.nextStepId,
        declineStepId: funnelSteps.declineStepId,
        funnelSlug: funnels.slug,
        published: funnelSteps.publishedVersionId,
      })
      .from(funnelSteps)
      .innerJoin(funnels, eq(funnels.id, funnelSteps.funnelId))
      .where(and(eq(funnelSteps.id, stepId), eq(funnelSteps.workspaceId, workspaceId), isNull(funnels.archivedAt)))
      .limit(1);
    if (!row?.published) return null;
    const pathOf = async (id: string | null) => {
      if (!id) return null;
      const [s] = await tx
        .select({ slug: funnelSteps.slug, published: funnelSteps.publishedVersionId })
        .from(funnelSteps)
        .where(eq(funnelSteps.id, id));
      return s?.published ? `/${row.funnelSlug}/${s.slug}` : null;
    };
    return { ...row, nextPath: await pathOf(row.nextStepId), declinePath: await pathOf(row.declineStepId) };
  });
}
