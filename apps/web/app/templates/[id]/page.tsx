import { Render } from "@puckeditor/core/rsc";
import { buildTemplate, config } from "@zfunnel/blocks";
import { notFound } from "next/navigation";
import { getT } from "@/lib/i18n";
import { requireUser } from "@/lib/session";

export async function generateMetadata() {
  return { title: (await getT())("templates.previewTitle"), robots: { index: false } };
}

/** Renders a template's first page, used for gallery thumbnails. */
export default async function TemplatePreview({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const steps = buildTemplate((await params).id);
  if (!steps) notFound();
  return (
    <div className="pointer-events-none">
      <Render config={config} data={steps[0]!.page as never} metadata={{ mode: "preview", offers: [] }} />
    </div>
  );
}
