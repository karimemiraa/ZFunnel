"use client";

import { useT } from "@zfunnel/i18n/react";
import { XIcon } from "lucide-react";
import { useTransition } from "react";
import { hideChecklist } from "@/lib/goal-actions";

export function HideChecklist({ slug }: { slug: string }) {
  const t = useT();
  const [busy, start] = useTransition();
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => start(() => hideChecklist(slug))}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      aria-label={t("today.hideChecklist")}
      title={t("today.hideChecklist")}
    >
      <XIcon className="size-4" />
    </button>
  );
}
