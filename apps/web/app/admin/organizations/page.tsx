import { Badge } from "@zfunnel/ui/badge";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { BuildingIcon } from "lucide-react";
import Link from "next/link";
import { Pager } from "@/components/admin/pager";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { requireAdmin } from "@/lib/admin";
import { listOrganizations, pageParam } from "@/lib/admin-data";
import { getFmt, getT } from "@/lib/i18n";

type Search = Promise<{ q?: string; page?: string }>;

export default async function AdminOrganizationsPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = pageParam(sp.page);
  const [{ rows, pages }, t, f] = await Promise.all([listOrganizations(q, page), getT(), getFmt()]);

  return (
    <>
      <PageHeader
        title={t("admin.orgs.title")}
        description={t("admin.orgs.description")}
        actions={<SearchInput placeholder={t("admin.orgs.search")} />}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<BuildingIcon />} title={t("admin.orgs.empty")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 text-start">{t("admin.orgs.name")}</th>
                <th className="px-4 py-3 text-start">{t("admin.orgs.plan")}</th>
                <th className="px-4 py-3 text-end max-sm:hidden">{t("admin.orgs.members")}</th>
                <th className="px-4 py-3 text-end max-sm:hidden">{t("admin.orgs.workspaces")}</th>
                <th className="px-4 py-3 text-start max-md:hidden">{t("admin.orgs.created")}</th>
                <th className="px-4 py-3 text-start">{t("admin.orgs.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/organizations/${o.id}`} className="font-medium hover:underline">
                      {o.name}
                    </Link>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {o.slug}
                    </div>
                  </td>
                  <td className="px-4 py-3">{t(`billing.planNames.${o.plan ?? "trial"}`)}</td>
                  <td className="px-4 py-3 text-end tabular-nums max-sm:hidden">{f.number(o.members)}</td>
                  <td className="px-4 py-3 text-end tabular-nums max-sm:hidden">{f.number(o.workspaces)}</td>
                  <td className="px-4 py-3 text-muted-foreground max-md:hidden">{f.date(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    {o.suspendedAt ? (
                      <Badge variant="warning">{t("admin.orgs.suspended")}</Badge>
                    ) : (
                      <Badge variant="success">{t("admin.orgs.active")}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager base="/admin/organizations" q={q} page={page} pages={pages} />
    </>
  );
}
