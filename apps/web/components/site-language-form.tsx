"use client";

import { LOCALE_NAMES, LOCALES, type Locale } from "@zfunnel/i18n";
import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import { toast } from "@zfunnel/ui/toaster";
import { cn } from "@zfunnel/ui/lib/utils";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSiteLanguage } from "@/lib/actions";

export function SiteLanguageForm({ slug, current, disabled }: { slug: string; current: Locale; disabled: boolean }) {
  const t = useT();
  const router = useRouter();
  const [v, setV] = useState(current);
  const [busy, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div
        className="inline-flex rounded-lg bg-muted p-1 text-sm"
        role="radiogroup"
        aria-label={t("settings.siteLanguage")}
      >
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={v === l}
            lang={l}
            disabled={disabled}
            onClick={() => setV(l)}
            className={cn(
              "rounded-md px-4 py-1.5 font-medium transition-all",
              v === l ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LOCALE_NAMES[l]}
          </button>
        ))}
      </div>
      <Button
        disabled={disabled || busy || v === current}
        onClick={() =>
          start(async () => {
            const r = await saveSiteLanguage(slug, v);
            if (!r.ok) return void toast.error(r.error);
            toast.success(t("settings.siteLanguageSaved"));
            router.refresh();
          })
        }
      >
        {busy && <Loader2Icon className="animate-spin" />} {t("common.save")}
      </Button>
    </div>
  );
}
