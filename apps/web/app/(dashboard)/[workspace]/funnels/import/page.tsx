import Link from "next/link";
import { ImportFunnelForm } from "@/components/funnels/import-form";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/context";
import { getT } from "@/lib/i18n";
import { IMPORT_LIMITS } from "@/lib/importer";

export async function generateMetadata() {
  return { title: (await getT())("importer.title") };
}

export default async function ImportFunnelPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const t = await getT();
  const ws = ctx.workspace.slug;
  return (
    <>
      <Link href={`/${ws}/funnels`} className="mb-3 inline-block text-sm text-muted-foreground hover:text-foreground">
        {t("importer.back")}
      </Link>
      <PageHeader title={t("importer.title")} description={t("importer.description")} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ImportFunnelForm workspaceSlug={ws} maxUrls={IMPORT_LIMITS.maxUrls} />
        <aside className="h-fit space-y-3 rounded-xl border bg-card p-5 text-sm">
          <h2 className="font-semibold">{t("importer.whatComesOver")}</h2>
          <p className="text-muted-foreground">{t("importer.comesOver")}</p>
          <p className="text-muted-foreground">{t("importer.notComesOver")}</p>
        </aside>
      </div>
    </>
  );
}
