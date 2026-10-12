"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@zfunnel/ui/dialog";
import { useT } from "@zfunnel/i18n/react";
import type { MessageKey } from "@zfunnel/i18n";
import { KeyboardIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { GO_SHORTCUTS } from "@/lib/nav";
import { useShell } from "./shell-provider";

/** True when the key press belongs to a text field, so shortcuts must stay out of the way. */
export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (target as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "reset", "range", "color", "file"].includes(type);
  }
  return target.closest("[role=textbox],[role=combobox]") !== null;
}

/** A dialog or menu already owns the keyboard. */
const overlayOpen = () => document.querySelector('[role="dialog"],[role="menu"],[role="alertdialog"]') !== null;

const G_TIMEOUT_MS = 1200;

/**
 * Global shortcuts (ROADMAP 8.5h): ⌘K/Ctrl+K palette, "/" search, "c" create, "?" help,
 * "[" sidebar and "g" then a letter to jump. Never fires while typing or inside an open overlay.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const { workspaceSlug, paletteOpen, setPaletteOpen, setHelpOpen, setCreateOpen, toggleCollapsed } = useShell();
  const pendingG = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      // ⌘K / Ctrl+K works everywhere, including text fields, and toggles.
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target) || overlayOpen()) {
        pendingG.current = 0;
        return;
      }
      const key = e.key;
      if (pendingG.current && Date.now() - pendingG.current < G_TIMEOUT_MS) {
        pendingG.current = 0;
        const go = GO_SHORTCUTS.find((s) => s.key === key.toLowerCase());
        if (go) {
          e.preventDefault();
          router.push(go.segment ? `/${workspaceSlug}/${go.segment}` : `/${workspaceSlug}`);
        }
        return;
      }
      pendingG.current = 0;
      if (key === "g" || key === "G") {
        pendingG.current = Date.now();
      } else if (key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      } else if (key === "c" || key === "C") {
        e.preventDefault();
        setCreateOpen(true);
      } else if (key === "[") {
        e.preventDefault();
        toggleCollapsed();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router, workspaceSlug, paletteOpen, setPaletteOpen, setHelpOpen, setCreateOpen, toggleCollapsed]);

  return <ShortcutsHelp />;
}

function Keys({ keys }: { keys: string[] }) {
  const t = useT();
  return (
    <span className="flex shrink-0 items-center gap-1" dir="ltr">
      {keys.map((k, i) => (
        <span key={`${k}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span className="text-xs text-muted-foreground">{t("topbar.shortcuts.then")}</span>}
          <kbd className="min-w-6 rounded border bg-muted px-1.5 py-0.5 text-center font-sans text-xs font-medium">
            {k}
          </kbd>
        </span>
      ))}
    </span>
  );
}

function Row({ label, keys }: { label: string; keys: string[] }) {
  return (
    <li className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span>{label}</span>
      <Keys keys={keys} />
    </li>
  );
}

/** The "?" help sheet. */
function ShortcutsHelp() {
  const t = useT();
  const { helpOpen, setHelpOpen } = useShell();
  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-xl" data-shortcuts-help>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyboardIcon className="size-5 text-brand-orange-text" /> {t("topbar.shortcuts.title")}
          </DialogTitle>
          <DialogDescription>{t("topbar.shortcuts.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 sm:grid-cols-2">
          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t("topbar.shortcuts.sections.general")}
            </h3>
            <ul className="divide-y">
              <Row label={t("topbar.shortcuts.palette")} keys={["⌘/Ctrl + K"]} />
              <Row label={t("topbar.shortcuts.search")} keys={["/"]} />
              <Row label={t("topbar.shortcuts.create")} keys={["C"]} />
              <Row label={t("topbar.shortcuts.sidebar")} keys={["["]} />
              <Row label={t("topbar.shortcuts.help")} keys={["?"]} />
            </ul>
          </section>
          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t("topbar.shortcuts.sections.goTo")}
            </h3>
            <ul className="divide-y">
              {GO_SHORTCUTS.map((s) => (
                <Row key={s.key} label={t(s.label as MessageKey)} keys={["G", s.key.toUpperCase()]} />
              ))}
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
