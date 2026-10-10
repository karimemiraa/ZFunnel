"use client";

import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { DEFAULT_EMAIL_THEME, type EmailTheme } from "@zfunnel/email";
import { emailConfig } from "@zfunnel/email/editor";
import { Button } from "@zfunnel/ui/button";
import { toast, Toaster } from "@zfunnel/ui/toaster";
import { ArrowLeftIcon, CheckIcon, CloudIcon, Loader2Icon, TriangleAlertIcon } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { saveEmailDesign } from "@/lib/email-actions";
import { AiAssist, EMAIL_AI_TARGETS } from "../editor/ai-assist";

type State = "saved" | "dirty" | "saving" | "error";
const AUTOSAVE_MS = 1000;

type Chrome = {
  backHref: string;
  name: string;
  indicator: React.ReactNode[];
  flush: () => Promise<boolean>;
  workspaceSlug: string;
  aiEnabled: boolean;
  dirty: () => boolean;
};
const EmailChrome = createContext<Chrome | null>(null);

function EmailHeader() {
  const c = useContext(EmailChrome)!;
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
      <Button variant="ghost" size="icon" asChild>
        <Link href={c.backHref} aria-label="Back" onClick={() => void (c.dirty() && c.flush())}>
          <ArrowLeftIcon />
        </Link>
      </Button>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-[11px] text-muted-foreground">Email</span>
        <span className="truncate text-sm font-semibold">{c.name}</span>
      </div>
      <div className="flex-1" />
      <AiAssist
        workspaceSlug={c.workspaceSlug}
        enabled={c.aiEnabled}
        targets={EMAIL_AI_TARGETS}
        context="marketing email"
      />
      <span
        className="hidden items-center gap-1.5 text-xs font-medium text-muted-foreground sm:inline-flex"
        role="status"
        aria-live="polite"
      >
        {c.indicator}
      </span>
      <Button
        onClick={async () => {
          if (await c.flush()) window.location.href = c.backHref;
        }}
      >
        Done
      </Button>
    </header>
  );
}

export function EmailEditor({
  aiEnabled,
  workspaceSlug,
  emailId,
  name,
  backHref,
  initialData,
}: {
  aiEnabled: boolean;
  workspaceSlug: string;
  emailId: string;
  name: string;
  backHref: string;
  initialData: Data;
}) {
  const [state, setState] = useState<State>("saved");
  const [theme, setTheme] = useState<EmailTheme>({
    ...DEFAULT_EMAIL_THEME,
    ...((initialData.root?.props ?? {}) as Partial<EmailTheme>),
  });
  const latest = useRef(initialData);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setState("saving");
    const r = await saveEmailDesign(workspaceSlug, emailId, latest.current);
    setState(r.ok ? "saved" : "error");
    if (!r.ok) toast.error(r.error);
    return r.ok;
  }, [workspaceSlug, emailId]);

  const onChange = useCallback(
    (data: Data) => {
      latest.current = data;
      setTheme({ ...DEFAULT_EMAIL_THEME, ...((data.root?.props ?? {}) as Partial<EmailTheme>) });
      setState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
    },
    [flush],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void flush();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (timer.current) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [flush]);

  const metadata = useMemo(() => ({ theme }), [theme]);
  const indicator = {
    saved: [<CheckIcon key="i" className="size-3.5" />, "Saved"],
    dirty: [<CloudIcon key="i" className="size-3.5" />, "Unsaved changes"],
    saving: [<Loader2Icon key="i" className="size-3.5 animate-spin" />, "Saving…"],
    error: [<TriangleAlertIcon key="i" className="size-3.5 text-destructive" />, "Not saved"],
  }[state];

  // Stable override (see page editor): live values come from context so the header never remounts.
  const chrome = useMemo(
    () => ({ backHref, name, indicator, flush, workspaceSlug, aiEnabled, dirty: () => Boolean(timer.current) }),
    [backHref, name, indicator, flush, workspaceSlug, aiEnabled],
  );
  const overrides = useMemo(() => ({ header: EmailHeader }), []);

  return (
    <EmailChrome.Provider value={chrome}>
      <div className="zf-editor h-dvh">
        <Puck
          config={emailConfig}
          data={initialData}
          metadata={metadata}
          onChange={onChange}
          overrides={overrides}
          iframe={{ enabled: true }}
          viewports={[
            { width: 720, height: "auto", label: "Desktop", icon: "Monitor" },
            { width: 390, height: "auto", label: "Mobile", icon: "Smartphone" },
          ]}
          height="100dvh"
        />
        <Toaster />
      </div>
    </EmailChrome.Provider>
  );
}
