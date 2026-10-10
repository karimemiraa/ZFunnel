import { Badge } from "@zfunnel/ui/badge";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { UsersIcon } from "lucide-react";
import { Pager } from "@/components/admin/pager";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { requireAdmin } from "@/lib/admin";
import { listUsers, pageParam } from "@/lib/admin-data";
import { getFmt, getT } from "@/lib/i18n";
import { isPlatformAdminUser } from "@/lib/platform-admin";

type Search = Promise<{ q?: string; page?: string }>;

export default async function AdminUsersPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const page = pageParam(sp.page);
  const [{ rows, pages }, t, f] = await Promise.all([listUsers(q, page), getT(), getFmt()]);
  const th = "px-4 py-3 text-start";

  return (
    <>
      <PageHeader
        title={t("admin.users.title")}
        description={t("admin.users.description")}
        actions={<SearchInput placeholder={t("admin.users.search")} />}
      />
      {rows.length === 0 ? (
        <EmptyState icon={<UsersIcon />} title={t("admin.users.empty")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className={th}>{t("admin.users.name")}</th>
                <th className={`${th} max-md:hidden`}>{t("admin.users.organizations")}</th>
                <th className={`${th} max-sm:hidden`}>{t("admin.users.joined")}</th>
                <th className={th}>{t("admin.orgs.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">
                      {u.email}
                    </div>
                  </td>
                  <td className="max-w-[18rem] truncate px-4 py-3 text-muted-foreground max-md:hidden">
                    {u.organizations.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-sm:hidden">{f.date(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {u.emailVerified ? (
                        <Badge variant="success">{t("admin.users.verified")}</Badge>
                      ) : (
                        <Badge variant="secondary">{t("admin.users.unverified")}</Badge>
                      )}
                      {isPlatformAdminUser(u, process.env.PLATFORM_ADMIN_EMAILS) && (
                        <Badge>{t("admin.users.admin")}</Badge>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager base="/admin/users" q={q} page={page} pages={pages} />
    </>
  );
}
