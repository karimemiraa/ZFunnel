import { notFound } from "next/navigation";
import { AutomationBuilder } from "@/components/automations/builder";
import { RunList } from "@/components/automations/run-list";
import { getWorkflow, listAutomationEmails, listRuns } from "@/lib/automations";
import { listProducts } from "@/lib/commerce";
import { allTags } from "@/lib/crm";
import { listCourses } from "@/lib/courses";
import { listFunnels } from "@/lib/funnels";
import { requireUser } from "@/lib/session";
import { getWorkspaceForUser } from "@/lib/workspaces";

export const metadata = { title: "Automation" };

export default async function AutomationPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ workspace, id }, { tab }, user] = await Promise.all([params, searchParams, requireUser()]);
  const ctx = await getWorkspaceForUser(user.id, workspace);
  if (!ctx) notFound();
  const wf = await getWorkflow(ctx, id);
  if (!wf) notFound();
  const activityTab = tab === "activity";
  const [funnels, products, tags, emails, courseList, runs] = await Promise.all([
    listFunnels(ctx),
    listProducts(ctx),
    allTags(ctx),
    listAutomationEmails(ctx),
    listCourses(ctx),
    activityTab ? listRuns(ctx, wf.id) : Promise.resolve([]),
  ]);
  return (
    <AutomationBuilder
      key={wf.id}
      workspaceSlug={workspace}
      tab={activityTab ? "activity" : "builder"}
      workflow={{
        id: wf.id,
        name: wf.name,
        status: wf.status,
        trigger: wf.trigger,
        graph: wf.graph,
        allowReentry: wf.allowReentry,
      }}
      lookups={{
        funnels: funnels.map((f) => ({ id: f.id, name: f.name })),
        products: products.map((p) => ({ id: p.id, name: p.name })),
        tags: tags.map((t) => t.tag),
        emails,
        courses: courseList.map((c) => ({ id: c.c.id, title: c.c.title })),
      }}
      activity={activityTab ? <RunList runs={runs} workspaceSlug={workspace} /> : null}
    />
  );
}
