"use client";

import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon, MessageSquareIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { saveSmsSettings } from "@/lib/sms-actions";

export function SmsSettingsForm({
  workspaceSlug,
  current,
}: {
  workspaceSlug: string;
  current: { accountSid: string; fromNumber: string } | null;
}) {
  const [pending, start] = useTransition();
  const [v, setV] = useState({
    accountSid: current?.accountSid ?? "",
    authToken: "",
    fromNumber: current?.fromNumber ?? "",
  });
  return (
    <form
      className="grid max-w-xl gap-4 rounded-xl border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveSmsSettings(workspaceSlug, v);
          if (r.ok) {
            toast.success(r.message ?? "Saved");
            setV({ ...v, authToken: "" });
          } else toast.error(r.error);
        });
      }}
    >
      <div className="flex items-start gap-3">
        <MessageSquareIcon className="mt-0.5 size-5 text-primary" />
        <div>
          <h2 className="font-semibold">SMS (Twilio)</h2>
          <p className="text-sm text-muted-foreground">
            Connect your Twilio account to send text messages from automations. Your auth token is encrypted and never
            shown again.
          </p>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sms-sid">Account SID</Label>
        <Input
          id="sms-sid"
          value={v.accountSid}
          onChange={(e) => setV({ ...v, accountSid: e.target.value })}
          placeholder="AC…"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sms-token">Auth token</Label>
        <Input
          id="sms-token"
          type="password"
          autoComplete="off"
          value={v.authToken}
          onChange={(e) => setV({ ...v, authToken: e.target.value })}
          placeholder={current ? "•••••••• (leave empty to keep)" : ""}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="sms-from">From number</Label>
        <Input
          id="sms-from"
          value={v.fromNumber}
          onChange={(e) => setV({ ...v, fromNumber: e.target.value })}
          placeholder="+14155550100"
        />
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />} Save
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Only contacts with a phone number get texts. Follow local SMS consent rules (for example TCPA in the US).
      </p>
    </form>
  );
}
