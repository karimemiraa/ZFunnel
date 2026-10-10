import { Badge } from "@zfunnel/ui/badge";
import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { NativeSelect } from "@zfunnel/ui/select";
import { ContactIcon, EyeIcon, FilterIcon, ShoppingCartIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatCard } from "@/components/stat-card";
import { requireAdmin } from "@/lib/admin";
import { overridePlan, startViewAs, suspendOrganization, unsuspendOrganization } from "@/lib/admin-actions";
import { getOrganizationDetail } from "@/lib/admin-data";
import { getFmt, getT } from "@/lib/i18n";

const PLAN_IDS = ["trial", "starter", "pro", "scale"] as const;

export default async function AdminOrganizationPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [d, t, f] = await Promise.all([getOrganizationDetail(id), getT(), getFmt()]);
  if (!d) notFound();
  const { org, billing, members, workspaces, usage } = d;
  const currentPlan = billing?.plan ?? "trial";
  const section = "rounded-xl border bg-card";
  const th = "px-4 py-3 text-start";

  return (
    <>
      <Link href="/admin/organizations" className="text-sm text-muted-foreground hover:text-foreground">
        {t("admin.org.back")}
      </Link>
      <div className="mt-3 mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            {org.name}
            {org.suspendedAt ? (
              <Badge variant="warning">{t("admin.orgs.suspended")}</Badge>
            ) : (
              <Badge variant="success">{t("admin.orgs.active")}</Badge>
            )}
          </h1>
          <p className="text-sm text-muted-foreground">
            <span dir="ltr">{org.slug}</span> · {t("admin.org.created", { date: f.date(org.createdAt) })}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t("admin.org.funnels")} value={f.number(usage.funnels)} icon={FilterIcon} />
        <StatCard label={t("admin.org.contacts")} value={f.number(usage.contacts)} icon={ContactIcon} />
        <StatCard label={t("admin.org.orders")} value={f.number(usage.orders)} icon={ShoppingCartIcon} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className={section}>
            <h2 className="border-b px-5 py-3 text-sm font-semibold">{t("admin.org.workspaces")}</h2>
            {workspaces.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">{t("admin.org.noWorkspaces")}</p>
            ) : (
              <ul className="divide-y">
                {workspaces.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <div className="font-medium">{w.name}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">
                        {w.slug}
                      </div>
                    </div>
                    <form action={startViewAs}>
                      <input type="hidden" name="workspaceId" value={w.id} />
                      <Button type="submit" size="sm" variant="outline">
                        <EyeIcon /> {t("admin.org.viewAs")}
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${section} overflow-x-auto`}>
            <h2 className="border-b px-5 py-3 text-sm font-semibold">{t("admin.org.members")}</h2>
            {members.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">{t("admin.org.noMembers")}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className={th}>{t("admin.users.name")}</th>
                    <th className={th}>{t("admin.org.role")}</th>
                    <th className={`${th} max-sm:hidden`}>{t("admin.org.joined")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{m.name}</div>
                        <div className="text-xs text-muted-foreground" dir="ltr">
                          {m.email}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{m.role}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-sm:hidden">{f.date(m.joined)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className={`${section} space-y-3 p-5`}>
            <h2 className="text-sm font-semibold">{t("admin.org.plan")}</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("admin.org.plan")}</dt>
                <dd className="font-medium">{t(`billing.planNames.${currentPlan}`)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">{t("admin.org.planStatus")}</dt>
                <dd>{billing ? billing.status : t("admin.org.noBilling")}</dd>
              </div>
              {billing && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{t("admin.org.planSource")}</dt>
                  <dd>{billing.provider}</dd>
                </div>
              )}
            </dl>
          </section>

          <section className={`${section} space-y-6 p-5`}>
            <h2 className="text-sm font-semibold">{t("admin.org.actions")}</h2>

            <form action={overridePlan} className="space-y-2">
              <input type="hidden" name="organizationId" value={org.id} />
              <Label htmlFor="plan">{t("admin.org.planTitle")}</Label>
              <NativeSelect id="plan" name="plan" defaultValue={currentPlan}>
                {PLAN_IDS.map((p) => (
                  <option key={p} value={p}>
                    {t(`billing.planNames.${p}`)}
                  </option>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">{t("admin.org.planHint")}</p>
              <Button type="submit" size="sm">
                {t("admin.org.applyPlan")}
              </Button>
            </form>

            <div className="border-t pt-5">
              {org.suspendedAt ? (
                <form action={unsuspendOrganization} className="space-y-2">
                  <input type="hidden" name="organizationId" value={org.id} />
                  <p className="text-sm font-medium">
                    {t("admin.org.suspendedSince", { date: f.dateTime(org.suspendedAt) })}
                  </p>
                  {org.suspendReason && <p className="text-xs text-muted-foreground">{org.suspendReason}</p>}
                  <Button type="submit" size="sm" variant="outline">
                    {t("admin.org.unsuspend")}
                  </Button>
                </form>
              ) : (
                <form action={suspendOrganization} className="space-y-2">
                  <input type="hidden" name="organizationId" value={org.id} />
                  <Label htmlFor="reason">{t("admin.org.suspendTitle")}</Label>
                  <p className="text-xs text-muted-foreground">{t("admin.org.suspendHint")}</p>
                  <Input id="reason" name="reason" placeholder={t("admin.org.suspendReason")} maxLength={500} />
                  <Button type="submit" size="sm" variant="destructive">
                    {t("admin.org.suspend")}
                  </Button>
                </form>
              )}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
