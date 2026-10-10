import { notFound } from "next/navigation";
import { PageEditor } from "@/components/editor/page-editor";
import { getEditorOffers } from "@/lib/commerce";
import { getFunnel, getStepWithDraft } from "@/lib/funnels";
import { aiConfigured } from "@/lib/ai";
import { getT } from "@/lib/i18n";
import { getVariant } from "@/lib/split";
import { requireUser } from "@/lib/session";
import { getWorkspaceForUser } from "@/lib/workspaces";

export async function generateMetadata() {
  return { title: (await getT())("editor.title") };
}

export default async function EditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; stepId: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const [{ workspace, stepId }, { variant: variantId }, user] = await Promise.all([
    params,
    searchParams,
    requireUser(),
  ]);
  const ctx = await getWorkspaceForUser(user.id, workspace);
  if (!ctx) notFound();
  const row = await getStepWithDraft(ctx, stepId);
  if (!row) notFound();
  const [funnel, offers, variant] = await Promise.all([
    getFunnel(ctx, row.funnel.id),
    getEditorOffers(ctx, stepId),
    variantId ? getVariant(ctx, variantId) : Promise.resolve(null),
  ]);
  if (variantId && variant?.stepId !== stepId) notFound();

  return (
    <PageEditor
      key={variant?.id ?? stepId}
      workspaceSlug={workspace}
      step={{ id: row.step.id, name: row.step.name, type: row.step.type }}
      funnel={{ id: row.funnel.id, name: row.funnel.name }}
      steps={(funnel?.steps ?? []).map((s) => ({ id: s.id, name: s.name, type: s.type }))}
      initialData={(variant?.draft ?? row.step.draft) as never}
      savedAt={(variant?.draftUpdatedAt ?? row.step.draftUpdatedAt).toISOString()}
      variant={variant ? { id: variant.id, name: variant.name } : undefined}
      aiEnabled={aiConfigured()}
      offers={offers}
      siteLocale={ctx.workspace.siteLocale}
    />
  );
}
