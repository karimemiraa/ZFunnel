import { EmptyState } from "@zfunnel/ui/empty-state";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/context";
import { NAV_MODULES } from "@/lib/nav";

/** Placeholder screens for modules on the roadmap, so the full product shape is visible now. */
export default async function ModulePage({ params }: { params: Promise<{ workspace: string; module: string }> }) {
  const { module } = await params;
  const item = NAV_MODULES.find((m) => m.segment && m.segment === module);
  if (!item) notFound();
  await requireWorkspace(params);
  const Icon = item.icon;

  return (
    <>
      <PageHeader title={item.label} description={item.description} />
      <EmptyState
        icon={<Icon />}
        title={`${item.label} is coming in Phase ${item.phase}`}
        description="This section is part of the ZFunnel roadmap. The navigation is in place so you can see where everything will live."
      />
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  return { title: NAV_MODULES.find((m) => m.segment === module)?.label ?? "Not found" };
}
