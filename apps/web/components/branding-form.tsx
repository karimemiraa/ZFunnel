"use client";

import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { toast } from "@zfunnel/ui/toaster";
import { useT } from "@zfunnel/i18n/react";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { saveBranding } from "@/lib/actions";

export function BrandingForm({
  slug,
  name,
  initial,
  canWhiteLabel,
  disabled,
}: {
  slug: string;
  name: string;
  initial: { logoUrl: string; brandColor: string; hideBadge: boolean };
  canWhiteLabel: boolean;
  disabled: boolean;
}) {
  const t = useT();
  const [v, setV] = useState(initial);
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await saveBranding(slug, v);
      if (r.ok) toast.success(t("workspace.branding.saved"));
      else toast.error(r.error);
    });
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="brand-logo">{t("workspace.branding.logoUrl")}</Label>
          <Input
            id="brand-logo"
            placeholder="https://…/logo.png"
            dir="ltr"
            value={v.logoUrl}
            disabled={disabled}
            onChange={(e) => setV({ ...v, logoUrl: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">{t("workspace.branding.logoHint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-color">{t("workspace.branding.brandColor")}</Label>
          <div className="flex max-w-xs items-center gap-2">
            <input
              type="color"
              aria-label={t("workspace.branding.pickBrandColor")}
              value={v.brandColor}
              disabled={disabled}
              onChange={(e) => setV({ ...v, brandColor: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent"
            />
            <Input
              id="brand-color"
              dir="ltr"
              value={v.brandColor}
              disabled={disabled}
              onChange={(e) => setV({ ...v, brandColor: e.target.value })}
            />
          </div>
        </div>
        <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={v.hideBadge}
            disabled={disabled || (!canWhiteLabel && !v.hideBadge)}
            onChange={(e) => setV({ ...v, hideBadge: e.target.checked })}
          />
          <span>
            <span className="font-medium">{t("workspace.branding.removeBadge")}</span>
            <span className="block text-muted-foreground">
              {canWhiteLabel ? (
                t("workspace.branding.removeBadgeHint")
              ) : (
                <>
                  {t("workspace.branding.availableOn")}{" "}
                  <Link href={`/${slug}/settings/billing`} className="font-medium text-primary hover:underline">
                    <SparklesIcon className="inline size-3.5" /> {t("workspace.branding.upgrade")}
                  </Link>
                </>
              )}
            </span>
          </span>
        </label>
        <Button onClick={save} disabled={busy || disabled}>
          {busy && <Loader2Icon className="animate-spin" />} {t("workspace.branding.save")}
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("workspace.branding.preview")}
        </p>
        <div className="overflow-hidden rounded-xl border bg-white text-zinc-900 shadow-sm">
          <div className="flex h-12 items-center border-b px-4 text-sm font-semibold">
            {/^https:\/\/\S+$/.test(v.logoUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.logoUrl} alt={name} className="h-6 w-auto max-w-[140px] object-contain" />
            ) : (
              name
            )}
          </div>
          <div className="space-y-3 p-4">
            <div className="h-2.5 w-3/4 rounded bg-zinc-100" />
            <div className="h-2.5 w-1/2 rounded bg-zinc-100" />
            <span
              className="inline-block rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
              style={{ background: /^#[0-9a-f]{6}$/i.test(v.brandColor) ? v.brandColor : "#4f46e5" }}
            >
              {t("workspace.branding.previewButton")}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
