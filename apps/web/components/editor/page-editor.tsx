"use client";

import { dir, type Locale } from "@zfunnel/i18n";
import { useT } from "@zfunnel/i18n/react";

import { createUsePuck, Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import type { config } from "@zfunnel/blocks";
import { configFor, type BlockRuntime, type RuntimeOffer } from "@zfunnel/blocks";
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
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { publishStep, publishVariant, saveDraft, saveVariantDraft } from "@/lib/funnel-actions";
import { STEP_COLORS } from "../funnels/step-type";
import { AiAssist, PAGE_AI_TARGETS } from "./ai-assist";
import { AI_FIELD_TYPES, AiWriterContext } from "./ai-field";
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
  offers: RuntimeOffer[];
  /** The site's language: blocks show their built-in text in it, and the canvas uses its direction. */
  siteLocale: Locale;
  /** Editing a split-test variant instead of the step's own page. */
  variant?: { id: string; name: string };
  aiEnabled: boolean;
  /** AI writer on each text field (8.5j): platform admins only, and only when AI is configured. */
  aiWriter?: boolean;
};

const AUTOSAVE_MS = 1200;

function SaveIndicator({ state }: { state: SaveState }) {
  const t = useT();
  const map = {
    saved: { icon: <CheckIcon className="size-3.5" />, text: t("common.saved"), cls: "text-muted-foreground" },
    dirty: { icon: <CloudIcon className="size-3.5" />, text: t("editor.unsaved"), cls: "text-muted-foreground" },
    saving: {
      icon: <Loader2Icon className="size-3.5 animate-spin" />,
      text: t("common.saving"),
      cls: "text-muted-foreground",
    },
    error: { icon: <TriangleAlertIcon className="size-3.5" />, text: t("editor.notSaved"), cls: "text-destructive" },
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

type Chrome = { props: Props; saveState: SaveState; onPublish: () => void; publishing: boolean };
const ChromeContext = createContext<Chrome | null>(null);
function HeaderFromContext() {
  const c = useContext(ChromeContext)!;
  return <EditorHeader {...c} />;
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
  const t = useT();
  const router = useRouter();
  const history = usePuck((s) => s.history);
  const back = `/${props.workspaceSlug}/funnels/${props.funnel.id}?step=${props.step.id}`;
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
      <Tooltip label={t("editor.backToFunnel")} side="bottom">
        <Button variant="ghost" size="icon" asChild>
          <Link href={back} aria-label={t("editor.backToFunnel")}>
            <ArrowLeftIcon className="rtl:-scale-x-100" />
          </Link>
        </Button>
      </Tooltip>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-10 max-w-[45vw] gap-2 px-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: STEP_COLORS[props.step.type] }} />
            <span className="flex min-w-0 flex-col items-start leading-tight">
              <span className="max-w-full truncate text-[11px] text-muted-foreground">{props.funnel.name}</span>
              <span className="max-w-full truncate text-sm font-semibold">
                {props.step.name}
                {props.variant && (
                  <span className="ms-1.5 rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400">
                    {t("editor.variantBadge", { name: props.variant.name })}
                  </span>
                )}
              </span>
            </span>
            <ChevronDownIcon className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{t("editor.switchStep")}</DropdownMenuLabel>
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
            <Link href={back}>{t("editor.backToOverview")}</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ms-1 flex items-center">
        <Tooltip label={t("editor.undoShortcut")} side="bottom">
          <Button
            variant="ghost"
            size="icon"
            disabled={!history.hasPast}
            onClick={history.back}
            aria-label={t("editor.undo")}
          >
            <Undo2Icon />
          </Button>
        </Tooltip>
        <Tooltip label={t("editor.redoShortcut")} side="bottom">
          <Button
            variant="ghost"
            size="icon"
            disabled={!history.hasFuture}
            onClick={history.forward}
            aria-label={t("editor.redo")}
          >
            <Redo2Icon />
          </Button>
        </Tooltip>
      </div>

      <div className="flex-1" />
      <SaveIndicator state={saveState} />
      <AiAssist
        workspaceSlug={props.workspaceSlug}
        enabled={props.aiEnabled}
        targets={PAGE_AI_TARGETS}
        context={`${props.step.type} page in a funnel called “${props.funnel.name}”`}
      />
      <Button variant="outline" asChild>
        <a
          href={`/preview/${props.workspaceSlug}/${props.step.id}${props.variant ? `?variant=${props.variant.id}` : ""}`}
          target="_blank"
          rel="noreferrer"
        >
          <EyeIcon /> <span className="max-sm:hidden">{t("editor.preview")}</span>
        </a>
      </Button>
      <Button onClick={onPublish} disabled={publishing}>
        {publishing ? <Loader2Icon className="animate-spin" /> : <RocketIcon />} {t("editor.publish")}
      </Button>
    </header>
  );
}

/** Sets the canvas iframe's language and direction to the site's (read from context, stays stable). */
function CanvasDirection({ children, document: doc }: { children: React.ReactNode; document?: Document }) {
  const { props } = useContext(ChromeContext)!;
  useEffect(() => {
    if (!doc) return;
    doc.documentElement.setAttribute("lang", props.siteLocale);
    doc.documentElement.setAttribute("dir", dir(props.siteLocale));
  }, [doc, props.siteLocale]);
  return <>{children}</>;
}

export function PageEditor(props: Props) {
  const t = useT();
  const [saveState, setSaveState] = useState<SaveState>({ kind: "saved", at: new Date(props.savedAt) });
  const [publishing, setPublishing] = useState(false);
  const latest = useRef<Data>(props.initialData);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<unknown> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setSaveState({ kind: "saving" });
    const p = props.variant
      ? saveVariantDraft(props.workspaceSlug, props.variant.id, latest.current)
      : saveDraft(props.workspaceSlug, props.step.id, latest.current);
    inflight.current = p;
    const res = await p;
    inflight.current = null;
    if (res.ok) setSaveState({ kind: "saved", at: new Date(res.savedAt!) });
    else {
      setSaveState({ kind: "error", message: res.error });
      toast.error(res.error);
    }
    return res.ok;
  }, [props.workspaceSlug, props.step.id, props.variant]);

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
    const res = props.variant
      ? await publishVariant(props.workspaceSlug, props.variant.id, latest.current)
      : await publishStep(props.workspaceSlug, props.step.id, latest.current);
    setPublishing(false);
    if (res.ok) {
      setSaveState({ kind: "saved", at: new Date() });
      toast.success(props.variant ? t("editor.variantLive", { name: props.variant.name }) : t("editor.published"));
    } else toast.error(res.error);
  }, [props.workspaceSlug, props.step.id, props.variant, t]);

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

  const metadata = useMemo<BlockRuntime>(
    () => ({ mode: "editor", offers: props.offers, payments: { provider: "test" }, lang: props.siteLocale }),
    [props.offers, props.siteLocale],
  );
  // Overrides must stay referentially stable: a new header component would remount it
  // (and lose open panels or a pending AI answer) on every autosave. Live values flow via context.
  const chrome = useMemo(
    () => ({ props, saveState, onPublish, publishing }),
    [props, saveState, onPublish, publishing],
  );
  const overrides = useMemo(
    () => ({
      header: HeaderFromContext,
      iframe: CanvasDirection,
      ...(props.aiWriter ? { fieldTypes: AI_FIELD_TYPES as never } : {}),
    }),
    [props.aiWriter],
  );
  const writer = useMemo(
    () => ({
      workspaceSlug: props.workspaceSlug,
      context: `${props.step.type} page in a funnel called “${props.funnel.name}”`,
    }),
    [props.workspaceSlug, props.step.type, props.funnel.name],
  );

  return (
    <ChromeContext.Provider value={chrome}>
      <AiWriterContext.Provider value={props.aiWriter ? writer : null}>
        <div className="zf-editor h-dvh">
          <Puck
            config={configFor(props.siteLocale)}
            data={props.initialData}
            metadata={metadata}
            onChange={onChange}
            onPublish={onPublish}
            overrides={overrides}
            iframe={{ enabled: true, waitForStyles: true }}
            viewports={[
              { width: 1280, height: "auto", label: t("editor.desktop"), icon: "Monitor" },
              { width: 820, height: "auto", label: t("editor.tablet"), icon: "Tablet" },
              { width: 390, height: "auto", label: t("editor.mobile"), icon: "Smartphone" },
            ]}
            height="100dvh"
          />
          <Toaster />
        </div>
      </AiWriterContext.Provider>
    </ChromeContext.Provider>
  );
}
