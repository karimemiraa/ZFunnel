import { EmptyState } from "@zfunnel/ui/empty-state";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/context";
import { getT } from "@/lib/i18n";
import { NAV_MODULES, navText } from "@/lib/nav";

/** Placeholder screens for modules on the roadmap, so the full product shape is visible now. */
export default async function ModulePage({ params }: { params: Promise<{ workspace: string; module: string }> }) {
  const { module } = await params;
  const item = NAV_MODULES.find((m) => m.segment && m.segment === module);
  if (!item) notFound();
  await requireWorkspace(params);
  const t = await getT();
  const Icon = item.icon;
  const label = navText(t, item.segment, "label");

  return (
    <>
      <PageHeader title={label} description={navText(t, item.segment, "description")} />
      <EmptyState
        icon={<Icon />}
        title={t("overview.comingTitle", { module: label })}
        description={t("overview.comingText")}
      />
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const t = await getT();
  const item = NAV_MODULES.find((m) => m.segment === module);
  return { title: item ? navText(t, item.segment, "label") : t("shell.notFound") };
}
