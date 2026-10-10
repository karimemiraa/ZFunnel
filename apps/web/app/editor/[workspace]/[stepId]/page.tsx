import { notFound } from "next/navigation";
import { PageEditor } from "@/components/editor/page-editor";
import { getFunnel, getStepWithDraft } from "@/lib/funnels";
import { requireUser } from "@/lib/session";
import { getWorkspaceForUser } from "@/lib/workspaces";

export const metadata = { title: "Editor" };

export default async function EditorPage({ params }: { params: Promise<{ workspace: string; stepId: string }> }) {
  const [{ workspace, stepId }, user] = await Promise.all([params, requireUser()]);
  const ctx = await getWorkspaceForUser(user.id, workspace);
  if (!ctx) notFound();
  const row = await getStepWithDraft(ctx, stepId);
  if (!row) notFound();
  const funnel = await getFunnel(ctx, row.funnel.id);

  return (
    <PageEditor
      key={stepId}
      workspaceSlug={workspace}
      step={{ id: row.step.id, name: row.step.name, type: row.step.type }}
      funnel={{ id: row.funnel.id, name: row.funnel.name }}
      steps={(funnel?.steps ?? []).map((s) => ({ id: s.id, name: s.name, type: s.type }))}
      initialData={row.step.draft as never}
      savedAt={row.step.draftUpdatedAt.toISOString()}
    />
  );
}
