import { Render } from "@puckeditor/core/rsc";
import { config, type BlockRuntime } from "@zfunnel/blocks";
import { dir } from "@zfunnel/i18n";
import { notFound } from "next/navigation";
import { getSharedFunnel } from "@/lib/share";

export const metadata = { robots: { index: false } };

/** Read-only render of one shared step (used in the share page's preview frame). */
export default async function SharedStep({ params }: { params: Promise<{ token: string; step: string }> }) {
  const { token, step } = await params;
  const shared = await getSharedFunnel(token);
  const s = shared?.steps[Number(step)];
  if (!s) notFound();
  const runtime: BlockRuntime = {
    mode: "preview",
    stepId: s.id,
    payments: { provider: "test" },
    lang: shared!.siteLocale,
  };
  return (
    <div className="pointer-events-none" dir={dir(shared!.siteLocale)} lang={shared!.siteLocale}>
      <Render config={config} data={s.draft as never} metadata={runtime} />
    </div>
  );
}
