"use client";

import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { toast } from "@zfunnel/ui/toaster";
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
  const [v, setV] = useState(initial);
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      const r = await saveBranding(slug, v);
      if (r.ok) toast.success("Branding saved");
      else toast.error(r.error);
    });
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="brand-logo">Logo URL</Label>
          <Input
            id="brand-logo"
            placeholder="https://…/logo.png"
            value={v.logoUrl}
            disabled={disabled}
            onChange={(e) => setV({ ...v, logoUrl: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Shown instead of your name on the customer center, courses, store, blog and in emails.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="brand-color">Brand color</Label>
          <div className="flex max-w-xs items-center gap-2">
            <input
              type="color"
              aria-label="Pick a brand color"
              value={v.brandColor}
              disabled={disabled}
              onChange={(e) => setV({ ...v, brandColor: e.target.value })}
              className="h-9 w-12 cursor-pointer rounded border bg-transparent"
            />
            <Input
              id="brand-color"
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
            <span className="font-medium">Remove “Powered by ZFunnel”</span>
            <span className="block text-muted-foreground">
              {canWhiteLabel ? (
                "Hide the small badge on your public pages."
              ) : (
                <>
                  Available on Pro and Scale.{" "}
                  <Link href={`/${slug}/settings/billing`} className="font-medium text-primary hover:underline">
                    <SparklesIcon className="inline size-3.5" /> Upgrade
                  </Link>
                </>
              )}
            </span>
          </span>
        </label>
        <Button onClick={save} disabled={busy || disabled}>
          {busy && <Loader2Icon className="animate-spin" />} Save branding
        </Button>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Preview</p>
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
              Sign in
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
