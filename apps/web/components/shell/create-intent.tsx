"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * "+ Create" lands on a module with `?create=1`; this opens that page's own primary "New …" action
 * (the last control in the shared PageHeader's actions), so every module keeps one creation flow.
 */
export function CreateIntent() {
  const params = useSearchParams();
  const pathname = usePathname();
  const wants = params.get("create") === "1";

  useEffect(() => {
    if (!wants) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      const actions = document.querySelector("[data-page-actions]");
      const controls = actions
        ? [...actions.querySelectorAll<HTMLElement>("button, a[href]")].filter(
            (el) => el.getAttribute("target") !== "_blank" && !el.hasAttribute("disabled"),
          )
        : [];
      const primary = controls.at(-1);
      if (primary || ++tries > 20) {
        window.clearInterval(timer);
        // Drop the flag without a navigation, so a form action the click starts isn't overridden.
        const rest = new URLSearchParams(params);
        rest.delete("create");
        window.history.replaceState(null, "", rest.size ? `${pathname}?${rest}` : pathname);
        primary?.click();
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [wants, params, pathname]);

  return null;
}
