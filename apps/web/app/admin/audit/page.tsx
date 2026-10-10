import { EmptyState } from "@zfunnel/ui/empty-state";
import { ScrollTextIcon } from "lucide-react";
import Link from "next/link";
import { Pager } from "@/components/admin/pager";
import { PageHeader } from "@/components/page-header";
import { requireAdmin } from "@/lib/admin";
import { listAdminAudit, pageParam } from "@/lib/admin-data";
import { getFmt, getT } from "@/lib/i18n";

const ACTION_KEYS = {
  "org.suspend": "orgSuspend",
  "org.unsuspend": "orgUnsuspend",
  "org.plan": "orgPlan",
  "viewAs.start": "viewAsStart",
  "viewAs.stop": "viewAsStop",
} as const;

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const page = pageParam((await searchParams).page);
  const [{ rows, pages }, t, f] = await Promise.all([listAdminAudit(page), getT(), getFmt()]);
  const th = "px-4 py-3 text-start";

  return (
    <>
      <PageHeader title={t("admin.audit.title")} description={t("admin.audit.description")} />
      {rows.length === 0 ? (
        <EmptyState icon={<ScrollTextIcon />} title={t("admin.audit.empty")} />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className={th}>{t("admin.audit.when")}</th>
                <th className={th}>{t("admin.audit.who")}</th>
                <th className={th}>{t("admin.audit.action")}</th>
                <th className={`${th} max-md:hidden`}>{t("admin.audit.details")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const key = ACTION_KEYS[r.action as keyof typeof ACTION_KEYS];
                const meta = r.metadata ?? {};
                const name = typeof meta.name === "string" ? meta.name : (r.targetId ?? "");
                const orgId =
                  r.targetType === "organization"
                    ? r.targetId
                    : typeof meta.organizationId === "string"
                      ? meta.organizationId
                      : null;
                return (
                  <tr key={r.id} className="align-top">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{f.dateTime(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.adminName ?? "—"}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        {r.adminEmail}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>{key ? t(`admin.audit.actions.${key}`) : r.action}</div>
                      <div className="text-xs text-muted-foreground">
                        {orgId ? (
                          <Link href={`/admin/organizations/${orgId}`} className="hover:underline">
                            {name}
                          </Link>
                        ) : (
                          name
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-md:hidden">
                      <code className="block max-w-md truncate text-xs text-muted-foreground" dir="ltr">
                        {JSON.stringify(meta)}
                      </code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager base="/admin/audit" page={page} pages={pages} />
    </>
  );
}
