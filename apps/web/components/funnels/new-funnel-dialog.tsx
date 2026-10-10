"use client";

import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@zfunnel/ui/dialog";
import { FormMessage } from "@zfunnel/ui/form-message";
import { Textarea } from "@zfunnel/ui/textarea";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { cn } from "@zfunnel/ui/lib/utils";
import { CheckIcon, LayoutTemplateIcon, Loader2Icon, PlusIcon, SparklesIcon, WorkflowIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { createFunnel } from "@/lib/funnel-actions";
import type { StepType } from "@/lib/funnels";
import { StepTypeDot } from "./step-type";

type Preset = { key: string; label: string; description: string; steps: [string, StepType][] };
type Template = { id: string; name: string; category: string; description: string; steps: [string, StepType][] };

function StepChips({ steps }: { steps: [string, StepType][] }) {
  const t = useT();
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {steps.map(([name, type], i) => (
        <span key={i} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <StepTypeDot type={type} />
          {name}
          {i < steps.length - 1 && <span className="text-muted-foreground/50">{t("funnels.forwardArrow")}</span>}
        </span>
      ))}
    </span>
  );
}

export function NewFunnelDialog({
  workspaceSlug,
  presets,
  templates,
  trigger,
  aiEnabled = false,
}: {
  workspaceSlug: string;
  presets: Preset[];
  templates: Template[];
  trigger?: React.ReactNode;
  aiEnabled?: boolean;
}) {
  const t = useT();
  const [state, action, pending] = useActionState(createFunnel.bind(null, workspaceSlug), null);
  const [tab, setTab] = useState<"templates" | "structures">("templates");
  const [source, setSource] = useState(`template:${templates[0]!.id}`);
  const [category, setCategory] = useState("");
  const categories = ["", ...new Set(templates.map((tpl) => tpl.category))];
  const shown = templates.filter((tpl) => !category || tpl.category === category);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <PlusIcon /> {t("funnels.newFunnel")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{t("funnels.createTitle")}</DialogTitle>
          <DialogDescription>{t("funnels.createDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="flex min-h-0 flex-col gap-5">
          <input type="hidden" name="source" value={source} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="funnel-name">{t("funnels.funnelName")}</Label>
              <Input
                id="funnel-name"
                name="name"
                placeholder={t("funnels.funnelNamePlaceholder")}
                required
                minLength={2}
                autoFocus
              />
              <FormMessage message={state?.fieldErrors?.name?.[0]} />
            </div>
            <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
              {(
                [
                  ["templates", t("funnels.tabTemplates"), LayoutTemplateIcon],
                  ["structures", t("funnels.tabStructures"), WorkflowIcon],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setTab(key);
                    setSource(key === "templates" ? `template:${templates[0]!.id}` : `preset:${presets[0]!.key}`);
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium",
                    tab === key ? "bg-background shadow-sm" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          {tab === "templates" ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      category === c ? "border-foreground bg-foreground text-background" : "hover:border-foreground/30",
                    )}
                  >
                    {c || t("templates.all")}
                  </button>
                ))}
              </div>
              <div className="-mx-1 grid max-h-[52dvh] gap-4 overflow-y-auto px-1 pb-1 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((tpl) => {
                  const selected = source === `template:${tpl.id}`;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => setSource(`template:${tpl.id}`)}
                      aria-pressed={selected}
                      className={cn(
                        "group relative overflow-hidden rounded-xl border text-start transition-all",
                        selected ? "border-primary ring-4 ring-primary/20" : "hover:border-foreground/25",
                      )}
                    >
                      <div className="relative h-36 overflow-hidden border-b bg-muted">
                        <iframe
                          src={`/templates/${tpl.id}`}
                          title={t("funnels.previewOf", { name: tpl.name })}
                          loading="lazy"
                          tabIndex={-1}
                          className="pointer-events-none absolute top-0 left-0 h-[600px] w-[1280px] origin-top-left scale-[0.245] border-0"
                        />
                        {selected && (
                          <span className="absolute end-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                            <CheckIcon className="size-4" />
                          </span>
                        )}
                      </div>
                      <div className="space-y-1.5 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{tpl.name}</span>
                          <span className="text-[11px] text-muted-foreground">{tpl.category}</span>
                        </div>
                        <p className="line-clamp-2 text-xs text-muted-foreground">{tpl.description}</p>
                        <StepChips steps={tpl.steps} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {presets.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setSource(`preset:${p.key}`)}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border p-4 text-start transition-colors",
                    source === `preset:${p.key}`
                      ? "border-primary bg-primary/[0.03] ring-4 ring-primary/20"
                      : "hover:border-primary/50",
                  )}
                >
                  <span className="font-medium">{p.label}</span>
                  <StepChips steps={p.steps} />
                </button>
              ))}
            </div>
          )}
          {aiEnabled && source.startsWith("template:") && (
            <div className="grid gap-2 rounded-xl border border-violet-300/50 bg-violet-500/5 p-4">
              <Label htmlFor="funnel-brief" className="flex items-center gap-1.5">
                <SparklesIcon className="size-4 text-violet-500" /> {t("funnels.aiBriefLabel")}
              </Label>
              <Textarea
                id="funnel-brief"
                name="brief"
                rows={3}
                maxLength={1500}
                placeholder={t("funnels.aiBriefPlaceholder")}
              />
            </div>
          )}
          <FormMessage message={state?.error ?? state?.fieldErrors?.source?.[0]} />
          <div className="flex items-center justify-end gap-3">
            {pending && <span className="text-sm text-muted-foreground">{t("funnels.building")}</span>}
            <Button type="submit" disabled={pending} size="lg">
              {pending && <Loader2Icon className="animate-spin" />}
              {t("funnels.createFunnel")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
