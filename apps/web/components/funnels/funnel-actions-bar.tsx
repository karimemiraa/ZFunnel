"use client";

import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@zfunnel/ui/dialog";
import { FormMessage } from "@zfunnel/ui/form-message";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { toast } from "@zfunnel/ui/toaster";
import { CopyPlusIcon, Loader2Icon, RocketIcon, SettingsIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useTransition } from "react";
import { archiveFunnel, duplicateFunnel, publishFunnel, updateFunnel } from "@/lib/funnel-actions";

export function FunnelActionsBar({
  workspaceSlug,
  funnel,
  isHome,
  origin,
  canDelete,
}: {
  workspaceSlug: string;
  funnel: { id: string; name: string; slug: string };
  isHome: boolean;
  origin: string;
  canDelete: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [state, action, saving] = useActionState(updateFunnel.bind(null, workspaceSlug, funnel.id), null);
  const host = origin.replace(/^https?:\/\//, "");

  useEffect(() => {
    if (state?.success) toast.success(t("funnels.settingsSaved"));
  }, [state, t]);

  return (
    <div className="flex items-center gap-2">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">
            <SettingsIcon /> {t("funnels.settings")}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("funnels.settingsTitle")}</DialogTitle>
            <DialogDescription>{t("funnels.settingsDescription")}</DialogDescription>
          </DialogHeader>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="f-name">{t("funnels.name")}</Label>
              <Input id="f-name" name="name" defaultValue={funnel.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-slug">{t("funnels.urlPath")}</Label>
              <div dir="ltr" className="flex items-center rounded-md border border-input">
                <span className="border-e px-3 text-sm whitespace-nowrap text-muted-foreground">{host}/</span>
                <input
                  id="f-slug"
                  name="slug"
                  defaultValue={funnel.slug}
                  required
                  dir="ltr"
                  className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
                />
              </div>
              <FormMessage message={state?.fieldErrors?.slug?.[0]} />
            </div>
            <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <input type="checkbox" name="home" defaultChecked={isHome} className="mt-0.5 size-4 accent-primary" />
              <span>
                <span className="font-medium">{t("funnels.useAsHomepage")}</span>
                <span className="block text-muted-foreground">
                  {t("funnels.useAsHomepageHint", { host: `${host}/` })}
                </span>
              </span>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      const r = await duplicateFunnel(workspaceSlug, funnel.id);
                      if (r && !r.ok) toast.error(r.error);
                    })
                  }
                >
                  <CopyPlusIcon /> {t("funnels.duplicate")}
                </Button>
                {canDelete && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(t("funnels.confirmDelete", { name: funnel.name })))
                        start(() => archiveFunnel(workspaceSlug, funnel.id));
                    }}
                  >
                    <Trash2Icon /> {t("common.delete")}
                  </Button>
                )}
              </div>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2Icon className="animate-spin" />}
                {t("common.save")}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Button
        disabled={busy}
        onClick={() =>
          start(async () => {
            const res = await publishFunnel(workspaceSlug, funnel.id);
            if (res.ok) toast.success(t("funnels.publishedSteps", { count: res.count ?? 0 }));
            else toast.error(res.error);
            router.refresh();
          })
        }
      >
        {busy ? <Loader2Icon className="animate-spin" /> : <RocketIcon />} {t("funnels.publishFunnel")}
      </Button>
    </div>
  );
}
