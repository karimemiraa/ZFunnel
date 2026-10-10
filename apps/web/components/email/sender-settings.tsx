"use client";

import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@zfunnel/ui/dialog";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { Textarea } from "@zfunnel/ui/textarea";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { saveEmailSettings } from "@/lib/email-actions";

type Settings = { fromName: string; replyTo: string; postalAddress: string } | null;

export function SenderSettings({
  workspaceSlug,
  settings,
  trigger,
}: {
  workspaceSlug: string;
  settings: Settings;
  trigger: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("email.senderSettings.title")}</DialogTitle>
          <DialogDescription>{t("email.senderSettings.description")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => {
              const r = await saveEmailSettings(workspaceSlug, {
                fromName: String(f.get("fromName")),
                replyTo: String(f.get("replyTo")),
                postalAddress: String(f.get("postalAddress")),
              });
              if (!r.ok) return setError(r.error);
              setError(null);
              toast.success(r.message ?? t("email.senderSettings.saved"));
              setOpen(false);
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="fromName">{t("email.senderSettings.fromName")}</Label>
            <Input
              id="fromName"
              name="fromName"
              defaultValue={settings?.fromName ?? ""}
              placeholder={t("email.senderSettings.fromNamePlaceholder")}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="replyTo">{t("email.senderSettings.replyTo")}</Label>
            <Input
              id="replyTo"
              name="replyTo"
              type="email"
              defaultValue={settings?.replyTo ?? ""}
              placeholder={t("email.senderSettings.replyToPlaceholder")}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="postalAddress">{t("email.senderSettings.postalAddress")}</Label>
            <Textarea
              id="postalAddress"
              name="postalAddress"
              rows={2}
              defaultValue={settings?.postalAddress ?? ""}
              placeholder={t("email.senderSettings.postalAddressPlaceholder")}
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} {t("email.senderSettings.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
