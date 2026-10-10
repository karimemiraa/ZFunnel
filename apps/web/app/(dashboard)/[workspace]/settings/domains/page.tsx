import { domains as domainsTable } from "@zfunnel/db";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { DomainsManager } from "@/components/domains-manager";
import { requireWorkspace } from "@/lib/context";
import { getT } from "@/lib/i18n";
import { SITES_CNAME_TARGET, SITES_IPV4 } from "@/lib/domains";
import { inWorkspace, listFunnels } from "@/lib/funnels";
import { siteOrigin } from "@/lib/urls";
import { canManage } from "@/lib/workspaces";

export async function generateMetadata() {
  return { title: (await getT())("settings.tabs.domains") };
}

export default async function DomainsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const [list, funnels] = await Promise.all([
    inWorkspace(ctx, (tx) => tx.select().from(domainsTable).orderBy(domainsTable.createdAt)),
    listFunnels(ctx),
  ]);
  const t = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("domains.freeSubdomain")}</CardTitle>
          <CardDescription>{t("domains.freeSubdomainHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <code dir="ltr" className="rounded bg-muted px-2 py-1 text-sm">
            {siteOrigin(ctx.workspace.slug).replace(/^https?:\/\//, "")}
          </code>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("domains.custom")}</CardTitle>
          <CardDescription>{t("domains.customHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {canManage(ctx.membership.role) ? (
            <DomainsManager
              workspaceSlug={ctx.workspace.slug}
              domains={list.map((d) => ({
                id: d.id,
                hostname: d.hostname,
                status: d.status,
                verificationToken: d.verificationToken,
                funnelId: d.funnelId,
                lastError: d.lastError,
              }))}
              funnels={funnels.map((f) => ({ id: f.id, name: f.name }))}
              cnameTarget={SITES_CNAME_TARGET}
              ipv4={SITES_IPV4}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{t("domains.onlyAdmins")}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
