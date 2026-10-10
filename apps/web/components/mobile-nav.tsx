"use client";

import { Button } from "@zfunnel/ui/button";
import { MenuIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SidebarNav } from "./sidebar-nav";

/** Slide-over navigation for small screens. */
export function MobileNav({ workspaceSlug, switcher }: { workspaceSlug: string; switcher: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <Button variant="ghost" size="icon" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <MenuIcon />
      </Button>
      {/* Portal: the sticky header's backdrop-filter would otherwise trap this fixed panel. */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
            <aside className="relative flex w-72 max-w-[85vw] flex-col gap-4 border-r bg-sidebar p-4">
              <div className="flex items-center gap-2">
                <div className="flex-1">{switcher}</div>
                <Button variant="ghost" size="icon" aria-label="Close menu" onClick={() => setOpen(false)}>
                  <XIcon />
                </Button>
              </div>
              <SidebarNav workspaceSlug={workspaceSlug} onNavigate={() => setOpen(false)} />
            </aside>
          </div>,
          document.body,
        )}
    </div>
  );
}
