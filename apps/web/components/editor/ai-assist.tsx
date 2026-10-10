"use client";

import { createUsePuck } from "@puckeditor/core";
import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Loader2Icon, SparklesIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { aiRewrite } from "@/lib/ai-actions";

const usePuck = createUsePuck();

/** Which prop of which block the AI can write, and how. */
export type AiTargets = Record<string, { prop: string; format: "plain" | "html"; role: string }>;

export const PAGE_AI_TARGETS: AiTargets = {
  Heading: { prop: "text", format: "plain", role: "headline" },
  Text: { prop: "text", format: "html", role: "paragraph" },
  Button: { prop: "label", format: "plain", role: "button" },
  Badge: { prop: "text", format: "plain", role: "short label" },
};
export const EMAIL_AI_TARGETS: AiTargets = {
  Heading: { prop: "text", format: "plain", role: "headline" },
  Text: { prop: "text", format: "html", role: "paragraph" },
  Button: { prop: "label", format: "plain", role: "button" },
};

const QUICK = [
  "Improve it",
  "Make it shorter",
  "Make it more persuasive",
  "Add urgency",
  "Make it friendlier",
  "Fix grammar",
];
const strip = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function AiAssist({
  workspaceSlug,
  enabled,
  context,
  targets,
}: {
  workspaceSlug: string;
  enabled: boolean;
  context: string;
  targets: AiTargets;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [lastInstruction, setLastInstruction] = useState("");
  const selected = usePuck((s) => s.selectedItem);
  const getSelectorForId = usePuck((s) => s.getSelectorForId);
  const dispatch = usePuck((s) => s.dispatch);
  const target = selected ? targets[selected.type] : undefined;
  const current = target && selected ? String((selected.props as Record<string, unknown>)[target.prop] ?? "") : "";

  async function run(instruction: string) {
    if (!target) return;
    setBusy(true);
    setError("");
    setResult(null);
    setLastInstruction(instruction);
    const r = await aiRewrite(workspaceSlug, {
      format: target.format,
      role: target.role,
      text: current,
      instruction,
      context,
    });
    setBusy(false);
    if (r.ok) setResult(r.text);
    else setError(r.error);
  }

  function apply() {
    if (!selected || !target || result === null) return;
    const sel = getSelectorForId(String((selected.props as { id: string }).id));
    if (!sel) return;
    dispatch({
      type: "replace",
      destinationIndex: sel.index,
      destinationZone: sel.zone,
      data: { ...selected, props: { ...selected.props, [target.prop]: result } },
    });
    setResult(null);
  }

  return (
    <div className="relative">
      <Button variant="outline" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="gap-1.5">
        <SparklesIcon className="text-violet-500" /> <span className="max-sm:hidden">AI</span>
      </Button>
      {open && (
        <div className="fixed end-4 top-16 z-50 max-h-[calc(100dvh-5rem)] w-[min(22rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-2xl">
          <div className="mb-3 flex items-center gap-2">
            <SparklesIcon className="size-4 text-violet-500" />
            <h2 className="flex-1 text-sm font-semibold">AI copywriter</h2>
            <Button variant="ghost" size="icon" className="size-7" aria-label="Close" onClick={() => setOpen(false)}>
              <XIcon />
            </Button>
          </div>
          {!enabled ? (
            <p className="text-sm text-muted-foreground">
              AI isn't set up on this server yet. Ask your admin to add an Anthropic API key.
            </p>
          ) : !target ? (
            <p className="text-sm text-muted-foreground">
              Select a heading, text or button on the page, then choose how to rewrite it.
            </p>
          ) : (
            <div className="grid gap-3">
              <p className="line-clamp-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{selected!.type}:</span> {strip(current) || "Empty"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(current.trim() ? QUICK : ["Write a compelling version"]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={busy}
                    onClick={() => void run(q)}
                    className="rounded-full border px-2.5 py-1 text-xs font-medium transition-colors hover:border-violet-400 hover:bg-violet-500/10 disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (custom.trim()) void run(custom.trim());
                }}
              >
                <Input
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  placeholder="Or tell the AI what to write…"
                  maxLength={500}
                  aria-label="AI instruction"
                />
                <Button type="submit" size="icon" disabled={busy || !custom.trim()} aria-label="Generate">
                  {busy ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                </Button>
              </form>
              {busy && <p className="text-xs text-muted-foreground">Writing…</p>}
              {error && (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}
              {result !== null && (
                <div className="grid gap-2 rounded-lg border border-violet-300/60 bg-violet-500/5 p-3">
                  {target.format === "html" ? (
                    <div className="prose-sm text-sm [&_p]:mb-2" dangerouslySetInnerHTML={{ __html: result }} />
                  ) : (
                    <p className="text-sm font-medium">{result}</p>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={apply}>
                      Use this
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(lastInstruction)}>
                      Try again
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
