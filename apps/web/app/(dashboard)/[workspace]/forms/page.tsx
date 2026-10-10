import { EmptyState } from "@zfunnel/ui/empty-state";
import { ClipboardListIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/context";
import { listForms } from "@/lib/forms";
import { getFmt, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await getT())("formsAdmin.pageTitle") };
}

export default async function FormsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const ws = ctx.workspace.slug;
  const [forms, t, fm] = await Promise.all([listForms(ctx), getT(), getFmt()]);
  return (
    <>
      <PageHeader title={t("formsAdmin.pageTitle")} description={t("formsAdmin.pageDescription")} />
      {forms.length === 0 ? (
        <EmptyState
          icon={<ClipboardListIcon />}
          title={t("formsAdmin.emptyTitle")}
          description={t("formsAdmin.emptyDescription")}
          action={
            <Link href={`/${ws}/funnels`} className="text-sm font-medium text-primary hover:underline">
              {t("formsAdmin.goToFunnels")}
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">{t("formsAdmin.colForm")}</th>
                <th className="px-4 py-3 max-md:hidden">{t("formsAdmin.colFunnel")}</th>
                <th className="px-4 py-3 text-end">{t("formsAdmin.colResponses")}</th>
                <th className="px-4 py-3 text-end max-sm:hidden">{t("formsAdmin.colLastResponse")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {forms.map((f) => (
                <tr key={`${f.stepId}-${f.blockId}`} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/${ws}/forms/${f.stepId}/${encodeURIComponent(f.blockId)}`}
                      className="font-medium hover:underline"
                    >
                      {f.formName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {t("formsAdmin.contactsCount", { count: f.contacts })}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-md:hidden">
                    {f.funnelName ?? t("formsAdmin.deletedFunnel")}
                    {f.stepName && <span className="text-xs"> · {f.stepName}</span>}
                  </td>
                  <td className="px-4 py-3 text-end font-semibold tabular-nums">{fm.number(f.responses)}</td>
                  <td className="px-4 py-3 text-end text-muted-foreground max-sm:hidden">
                    {fm.timeAgo(new Date(f.last))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
