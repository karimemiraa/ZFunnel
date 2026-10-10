"use client";

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
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sender settings</DialogTitle>
          <DialogDescription>
            Shown on every email you send. Anti-spam laws require a real postal address in the footer.
          </DialogDescription>
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
              toast.success(r.message ?? "Saved");
              setOpen(false);
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="fromName">Sender name</Label>
            <Input
              id="fromName"
              name="fromName"
              defaultValue={settings?.fromName ?? ""}
              placeholder="Jane from Acme"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="replyTo">Reply-to email</Label>
            <Input
              id="replyTo"
              name="replyTo"
              type="email"
              defaultValue={settings?.replyTo ?? ""}
              placeholder="jane@acme.com"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="postalAddress">Postal address</Label>
            <Textarea
              id="postalAddress"
              name="postalAddress"
              rows={2}
              defaultValue={settings?.postalAddress ?? ""}
              placeholder="Acme Inc, 1 Main St, Springfield, 12345, USA"
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
              {pending && <Loader2Icon className="animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
