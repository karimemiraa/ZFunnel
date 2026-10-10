"use client";

import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import { FormMessage } from "@zfunnel/ui/form-message";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { Textarea } from "@zfunnel/ui/textarea";
import { CheckCircle2Icon, DownloadIcon, Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { importFunnel, type ImportState } from "@/lib/import-actions";
import { StepTypeDot } from "./step-type";

export function ImportFunnelForm({ workspaceSlug, maxUrls }: { workspaceSlug: string; maxUrls: number }) {
  const t = useT();
  const [key, setKey] = useState(0);
  return (
    <ImportFormInner key={key} workspaceSlug={workspaceSlug} maxUrls={maxUrls} onReset={() => setKey(key + 1)} t={t} />
  );
}

function ImportFormInner({
  workspaceSlug,
  maxUrls,
  onReset,
  t,
}: {
  workspaceSlug: string;
  maxUrls: number;
  onReset: () => void;
  t: ReturnType<typeof useT>;
}) {
  const [state, action, pending] = useActionState<ImportState, FormData>(importFunnel.bind(null, workspaceSlug), null);

  if (state?.done) {
    const d = state.done;
    return (
      <div className="space-y-4 rounded-xl border bg-card p-6" role="status">
        <div className="flex items-center gap-2">
          <CheckCircle2Icon className="size-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">{t("importer.doneTitle")}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{t("importer.doneSummary", { count: d.steps.length })}</p>
        <ol className="divide-y rounded-lg border text-sm">
          {d.steps.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <StepTypeDot type={s.type} />
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground">{t(`funnels.stepTypes.${s.type}`)}</span>
              <span className="ms-auto text-xs text-muted-foreground">
                {t("importer.stepLine", { blocks: s.blocks })}
                {s.customHtml > 0 ? ` · ${t("importer.stepCustom", { count: s.customHtml })}` : ""}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          {d.imagesCopied > 0 && t("importer.imagesCopied", { count: d.imagesCopied })}{" "}
          {d.imagesFailed > 0 && t("importer.imagesFailed", { count: d.imagesFailed })}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/${workspaceSlug}/funnels/${d.funnelId}`}>{t("importer.openFunnel")}</Link>
          </Button>
          <Button variant="outline" onClick={onReset}>
            {t("importer.importAnother")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5 rounded-xl border bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="import-name">{t("importer.funnelName")}</Label>
        <Input
          id="import-name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          placeholder={t("importer.funnelNamePlaceholder")}
        />
        <FormMessage message={state?.fieldErrors?.name} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="import-urls">{t("importer.urls")}</Label>
        <Textarea
          id="import-urls"
          name="urls"
          required
          rows={6}
          dir="ltr"
          spellCheck={false}
          className="font-mono text-sm"
          placeholder={t("importer.urlsPlaceholder")}
        />
        <p className="text-xs text-muted-foreground">{t("importer.urlsHelp", { max: maxUrls })}</p>
        <FormMessage message={state?.fieldErrors?.urls} />
      </div>
      <div className="space-y-1">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirm" required className="mt-0.5 size-4" />
          <span>{t("importer.confirm")}</span>
        </label>
        <FormMessage message={state?.fieldErrors?.confirm} />
      </div>
      <FormMessage message={state?.error} />
      <Button type="submit" disabled={pending}>
        {pending ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
        {pending ? t("importer.importing") : t("importer.submit")}
      </Button>
    </form>
  );
}
