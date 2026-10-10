import { EmptyState } from "@zfunnel/ui/empty-state";
import { ClipboardListIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/context";
import { timeAgo } from "@/lib/format";
import { listForms } from "@/lib/forms";

export const metadata = { title: "Forms" };

export default async function FormsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const ws = ctx.workspace.slug;
  const forms = await listForms(ctx);
  return (
    <>
      <PageHeader title="Forms" description="Responses to the surveys, quizzes and forms on your funnel pages." />
      {forms.length === 0 ? (
        <EmptyState
          icon={<ClipboardListIcon />}
          title="No responses yet"
          description="Add the “Form / survey / quiz” block to any funnel page and publish it. Every response shows up here, summarized."
          action={
            <Link href={`/${ws}/funnels`} className="text-sm font-medium text-primary hover:underline">
              Go to funnels →
            </Link>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Form</th>
                <th className="px-4 py-3 max-md:hidden">Funnel</th>
                <th className="px-4 py-3 text-right">Responses</th>
                <th className="px-4 py-3 text-right max-sm:hidden">Last response</th>
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
                    <p className="text-xs text-muted-foreground">{f.contacts.toLocaleString()} contacts</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-md:hidden">
                    {f.funnelName ?? "Deleted funnel"}
                    {f.stepName && <span className="text-xs"> · {f.stepName}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{f.responses.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground max-sm:hidden">
                    {timeAgo(new Date(f.last))}
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
