"use client";

import { Button } from "@zfunnel/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zfunnel/ui/dropdown-menu";
import { FormMessage } from "@zfunnel/ui/form-message";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { NativeSelect } from "@zfunnel/ui/select";
import { toast } from "@zfunnel/ui/toaster";
import { Tooltip } from "@zfunnel/ui/tooltip";
import {
  CopyIcon,
  CopyPlusIcon,
  EyeIcon,
  EyeOffIcon,
  ExternalLinkIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  RocketIcon,
  Trash2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, useTransition } from "react";
import { deleteStep, duplicateStep, publishStep, unpublishStep, updateStep } from "@/lib/funnel-actions";
import type { StepType } from "@/lib/funnels";
import { STEP_LABELS, StepTypeBadge } from "./step-type";

type Step = {
  id: string;
  name: string;
  slug: string;
  type: StepType;
  nextStepId: string | null;
  declineStepId: string | null;
  status: "live" | "changed" | "draft";
};

export function StepPanel({
  step,
  others,
  workspaceSlug,
  liveUrl,
  base,
}: {
  step: Step;
  others: { id: string; name: string }[];
  workspaceSlug: string;
  liveUrl: string;
  base: string;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [state, action, saving] = useActionState(updateStep.bind(null, workspaceSlug, step.id), null);
  const [type, setType] = useState(step.type);

  useEffect(() => {
    if (state?.success) toast.success("Step settings saved");
  }, [state]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error ?? "Something went wrong");
      else {
        toast.success(success);
        after?.();
        router.refresh();
      }
    });

  const editorHref = `/editor/${workspaceSlug}/${step.id}`;
  const previewHref = `/preview/${workspaceSlug}/${step.id}`;
  const showDecline = type === "upsell" || type === "downsell";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-xl font-semibold tracking-tight">{step.name}</h2>
            <StepTypeBadge type={step.type} />
          </div>
          {step.status !== "draft" ? (
            <a
              href={liveUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            >
              {liveUrl.replace(/^https?:\/\//, "")} <ExternalLinkIcon className="size-3.5" />
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">Not published yet</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Tooltip label="Copy link">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Copy link"
              onClick={() => {
                void navigator.clipboard.writeText(liveUrl);
                toast.success("Link copied");
              }}
            >
              <CopyIcon />
            </Button>
          </Tooltip>
          <Button variant="outline" asChild>
            <a href={previewHref} target="_blank" rel="noreferrer">
              <EyeIcon /> Preview
            </a>
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => run(() => publishStep(workspaceSlug, step.id), "Published! Your page is live.")}
          >
            {busy ? <Loader2Icon className="animate-spin" /> : <RocketIcon />} Publish
          </Button>
          <Button asChild>
            <Link href={editorHref}>
              <PencilIcon /> Edit page
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => run(() => duplicateStep(workspaceSlug, step.id), "Step duplicated")}>
                <CopyPlusIcon /> Duplicate step
              </DropdownMenuItem>
              {step.status !== "draft" && (
                <DropdownMenuItem onClick={() => run(() => unpublishStep(workspaceSlug, step.id), "Step unpublished")}>
                  <EyeOffIcon /> Unpublish
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  if (confirm(`Delete “${step.name}”? This can't be undone.`))
                    run(
                      () => deleteStep(workspaceSlug, step.id),
                      "Step deleted",
                      () => router.replace(base),
                    );
                }}
              >
                <Trash2Icon /> Delete step
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Link
        href={editorHref}
        className="group relative block aspect-[16/10] overflow-hidden rounded-xl border bg-muted/50 shadow-sm transition-colors hover:border-primary/40"
        aria-label="Open the page editor"
      >
        <iframe
          key={step.id}
          src={`${previewHref}?thumb=1`}
          title={`${step.name} preview`}
          tabIndex={-1}
          className="pointer-events-none absolute top-0 left-0 h-[250%] w-[250%] origin-top-left scale-[0.4] border-0"
        />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-foreground shadow-lg">
            <PencilIcon className="size-4" /> Edit page
          </span>
        </span>
      </Link>

      <form
        action={action}
        className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2"
        key={`${step.id}-settings`}
      >
        <h3 className="font-semibold sm:col-span-2">Step settings</h3>
        <div className="space-y-2">
          <Label htmlFor="s-name">Name</Label>
          <Input id="s-name" name="name" defaultValue={step.name} required />
          <FormMessage message={state?.fieldErrors?.name?.[0]} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-slug">URL path</Label>
          <Input id="s-slug" name="slug" defaultValue={step.slug} required />
          <FormMessage message={state?.fieldErrors?.slug?.[0]} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-type">Step type</Label>
          <NativeSelect id="s-type" name="type" value={type} onChange={(e) => setType(e.target.value as StepType)}>
            {Object.entries(STEP_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="s-next">{showDecline ? "If they accept, go to" : "Next step"}</Label>
          <NativeSelect id="s-next" name="nextStepId" defaultValue={step.nextStepId ?? ""}>
            <option value="">End of funnel</option>
            {others.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        {showDecline ? (
          <div className="space-y-2 sm:col-start-2">
            <Label htmlFor="s-decline">If they decline, go to</Label>
            <NativeSelect id="s-decline" name="declineStepId" defaultValue={step.declineStepId ?? ""}>
              <option value="">End of funnel</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </NativeSelect>
          </div>
        ) : (
          <input type="hidden" name="declineStepId" value="" />
        )}
        <div className="flex items-center justify-end gap-3 sm:col-span-2">
          <FormMessage message={state?.error} />
          <Button type="submit" variant="secondary" disabled={saving}>
            {saving && <Loader2Icon className="animate-spin" />}
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
}
