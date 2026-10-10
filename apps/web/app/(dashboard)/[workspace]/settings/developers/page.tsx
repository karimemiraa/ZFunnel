import { apiKeys, desc, eq, webhookDeliveries, webhookEndpoints } from "@zfunnel/db";
import { Developers } from "@/components/developers/developers-ui";
import { requireWorkspace } from "@/lib/context";
import { inWorkspace } from "@/lib/funnels";
import { canManage } from "@/lib/workspaces";

export const metadata = { title: "Developers" };

export default async function DevelopersPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  if (!canManage(ctx.membership.role))
    return <p className="text-sm text-muted-foreground">Only owners and admins can manage API keys and webhooks.</p>;
  const { keys, hooks } = await inWorkspace(ctx, async (tx) => {
    const keys = await tx.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
    const endpoints = await tx.select().from(webhookEndpoints).orderBy(desc(webhookEndpoints.createdAt));
    const hooks = await Promise.all(
      endpoints.map(async (e) => ({
        e,
        deliveries: await tx
          .select()
          .from(webhookDeliveries)
          .where(eq(webhookDeliveries.endpointId, e.id))
          .orderBy(desc(webhookDeliveries.createdAt))
          .limit(8),
      })),
    );
    return { keys, hooks };
  });
  const apiBase = `${(process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/v1`;
  return (
    <Developers
      workspaceSlug={ctx.workspace.slug}
      apiBase={apiBase}
      keys={keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        revoked: !!k.revokedAt,
        createdAt: k.createdAt.toISOString(),
      }))}
      hooks={hooks.map(({ e, deliveries }) => ({
        id: e.id,
        url: e.url,
        events: e.events,
        secret: e.secret,
        status: e.status,
        deliveries: deliveries.map((d) => ({
          id: d.id,
          event: d.event,
          status: d.status,
          code: d.responseCode,
          at: d.createdAt.toISOString(),
          error: d.error,
        })),
      }))}
    />
  );
}
