import { Render } from "@puckeditor/core/rsc";
import { config, type BlockRuntime } from "@zfunnel/blocks";
import { notFound } from "next/navigation";
import { getEditorOffers } from "@/lib/commerce";
import { getStepWithDraft } from "@/lib/funnels";
import { requireUser } from "@/lib/session";
import { getWorkspaceForUser } from "@/lib/workspaces";

export const metadata = { title: "Preview", robots: { index: false } };

/** Draft preview for signed-in members. Buttons walk through draft steps; forms don't submit. */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; stepId: string }>;
  searchParams: Promise<{ thumb?: string }>;
}) {
  const [{ workspace, stepId }, { thumb }, user] = await Promise.all([params, searchParams, requireUser()]);
  const ctx = await getWorkspaceForUser(user.id, workspace);
  if (!ctx) notFound();
  const row = await getStepWithDraft(ctx, stepId);
  if (!row) notFound();

  const link = (id: string | null) => (id ? `/preview/${workspace}/${id}` : undefined);
  const runtime: BlockRuntime = {
    mode: "preview",
    nextUrl: link(row.step.nextStepId),
    declineUrl: link(row.step.declineStepId),
    stepId,
    offers: await getEditorOffers(ctx, stepId),
    payments: { provider: "test" },
  };

  return (
    <div className={thumb ? "pointer-events-none overflow-hidden" : undefined}>
      {!thumb && (
        <div className="fixed right-3 bottom-3 z-50 rounded-full bg-black/80 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur">
          Draft preview · {row.step.name}
        </div>
      )}
      <Render config={config} data={row.step.draft as never} metadata={runtime} />
    </div>
  );
}
