"use client";

import { createUsePuck, Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { config, type BlockRuntime } from "@zfunnel/blocks";
import { Button } from "@zfunnel/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zfunnel/ui/dropdown-menu";
import { cn } from "@zfunnel/ui/lib/utils";
import { toast, Toaster } from "@zfunnel/ui/toaster";
import { Tooltip } from "@zfunnel/ui/tooltip";
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  CloudIcon,
  EyeIcon,
  Loader2Icon,
  Redo2Icon,
  RocketIcon,
  TriangleAlertIcon,
  Undo2Icon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { publishStep, saveDraft } from "@/lib/funnel-actions";
import { STEP_COLORS } from "../funnels/step-type";
import type { StepType } from "@/lib/funnels";

const usePuck = createUsePuck<typeof config>();

type SaveState =
  { kind: "saved"; at: Date } | { kind: "dirty" } | { kind: "saving" } | { kind: "error"; message: string };

type Props = {
  workspaceSlug: string;
  step: { id: string; name: string; type: StepType };
  funnel: { id: string; name: string };
  steps: { id: string; name: string; type: StepType }[];
  initialData: Data;
  savedAt: string;
};

const AUTOSAVE_MS = 1200;
const metadata: BlockRuntime = { mode: "editor" };

function SaveIndicator({ state }: { state: SaveState }) {
  const map = {
    saved: { icon: <CheckIcon className="size-3.5" />, text: "Saved", cls: "text-muted-foreground" },
    dirty: { icon: <CloudIcon className="size-3.5" />, text: "Unsaved changes", cls: "text-muted-foreground" },
    saving: { icon: <Loader2Icon className="size-3.5 animate-spin" />, text: "Saving…", cls: "text-muted-foreground" },
    error: { icon: <TriangleAlertIcon className="size-3.5" />, text: "Not saved", cls: "text-destructive" },
  }[state.kind];
  return (
    <span
      className={cn("hidden items-center gap-1.5 text-xs font-medium sm:inline-flex", map.cls)}
      role="status"
      aria-live="polite"
    >
      {map.icon}
      {map.text}
    </span>
  );
}

function EditorHeader({
  props,
  saveState,
  onPublish,
  publishing,
}: {
  props: Props;
  saveState: SaveState;
  onPublish: () => void;
  publishing: boolean;
}) {
  const router = useRouter();
  const history = usePuck((s) => s.history);
  const back = `/${props.workspaceSlug}/funnels/${props.funnel.id}?step=${props.step.id}`;
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
      <Tooltip label="Back to funnel" side="bottom">
        <Button variant="ghost" size="icon" asChild>
          <Link href={back} aria-label="Back to funnel">
            <ArrowLeftIcon />
          </Link>
        </Button>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 max-w-[45vw] gap-2 px-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: STEP_COLORS[props.step.type] }} />
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span className="max-w-full truncate text-[11px] text-muted-foreground">{props.funnel.name}</span>
              <span className="max-w-full truncate text-sm font-semibold">{props.step.name}</span>
            </span>
            <ChevronDownIcon className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Switch step</DropdownMenuLabel>
          {props.steps.map((s, i) => (
            <DropdownMenuItem
              key={s.id}
              onClick={() => router.push(`/editor/${props.workspaceSlug}/${s.id}`)}
              className={cn(s.id === props.step.id && "font-semibold")}
            >
              <span className="w-4 text-xs text-muted-foreground">{i + 1}</span>
              <span className="size-2 rounded-full" style={{ background: STEP_COLORS[s.type] }} />
              <span className="flex-1 truncate">{s.name}</span>
              {s.id === props.step.id && <CheckIcon />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={back}>Back to funnel overview</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-1 flex items-center">
        <Tooltip label="Undo (⌘Z)" side="bottom">
          <Button variant="ghost" size="icon" disabled={!history.hasPast} onClick={history.back} aria-label="Undo">
            <Undo2Icon />
          </Button>
        </Tooltip>
        <Tooltip label="Redo (⇧⌘Z)" side="bottom">
          <Button variant="ghost" size="icon" disabled={!history.hasFuture} onClick={history.forward} aria-label="Redo">
            <Redo2Icon />
          </Button>
        </Tooltip>
      </div>

      <div className="flex-1" />
      <SaveIndicator state={saveState} />
      <Button variant="outline" asChild>
        <a href={`/preview/${props.workspaceSlug}/${props.step.id}`} target="_blank" rel="noreferrer">
          <EyeIcon /> <span className="max-sm:hidden">Preview</span>
        </a>
      </Button>
      <Button onClick={onPublish} disabled={publishing}>
        {publishing ? <Loader2Icon className="animate-spin" /> : <RocketIcon />} Publish
      </Button>
    </header>
  );
}

export function PageEditor(props: Props) {
  const [saveState, setSaveState] = useState<SaveState>({ kind: "saved", at: new Date(props.savedAt) });
  const [publishing, setPublishing] = useState(false);
  const latest = useRef<Data>(props.initialData);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<unknown> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSaveState({ kind: "saving" });
    const p = saveDraft(props.workspaceSlug, props.step.id, latest.current);
    inflight.current = p;
    const res = await p;
    inflight.current = null;
    if (res.ok) setSaveState({ kind: "saved", at: new Date(res.savedAt!) });
    else {
      setSaveState({ kind: "error", message: res.error });
      toast.error(res.error);
    }
    return res.ok;
  }, [props.workspaceSlug, props.step.id]);

  const onChange = useCallback(
    (data: Data) => {
      latest.current = data;
      setSaveState({ kind: "dirty" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush],
  );

  const onPublish = useCallback(async () => {
    setPublishing(true);
    if (timer.current) clearTimeout(timer.current);
    const res = await publishStep(props.workspaceSlug, props.step.id, latest.current);
    setPublishing(false);
    if (res.ok) {
      setSaveState({ kind: "saved", at: new Date() });
      toast.success("Published! Your page is live.");
    } else toast.error(res.error);
  }, [props.workspaceSlug, props.step.id]);

  // ⌘S / Ctrl+S saves immediately; warn before leaving with unsaved changes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (timer.current || inflight.current) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [flush]);

  const overrides = useMemo(
    () => ({
      header: () => <EditorHeader props={props} saveState={saveState} onPublish={onPublish} publishing={publishing} />,
    }),
    [props, saveState, onPublish, publishing],
  );

  return (
    <div className="zf-editor h-dvh">
      <Puck
        config={config}
        data={props.initialData}
        metadata={metadata}
        onChange={onChange}
        onPublish={onPublish}
        overrides={overrides}
        iframe={{ enabled: true, waitForStyles: true }}
        viewports={[
          { width: 1280, height: "auto", label: "Desktop", icon: "Monitor" },
          { width: 820, height: "auto", label: "Tablet", icon: "Tablet" },
          { width: 390, height: "auto", label: "Mobile", icon: "Smartphone" },
        ]}
        height="100dvh"
      />
      <Toaster />
    </div>
  );
}
