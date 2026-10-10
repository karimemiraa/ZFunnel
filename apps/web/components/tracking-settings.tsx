"use client";

import { Button } from "@zfunnel/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { toast } from "@zfunnel/ui/toaster";
import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disconnectTrackingPlatform, saveTrackingPlatform, type Platform } from "@/lib/tracking-actions";

type Current = { id: string | null; hasToken: boolean; testCode: string | null };

const COPY: Record<
  Platform,
  { title: string; description: string; idLabel: string; idHint: string; tokenLabel: string; test: boolean }
> = {
  meta: {
    title: "Meta Conversions API",
    description:
      "Sends Lead and Purchase to Facebook and Instagram ads from the server, so ad blockers can't hide sales.",
    idLabel: "Pixel (dataset) ID",
    idHint: "Events Manager → Data sources → your pixel",
    tokenLabel: "Access token",
    test: true,
  },
  tiktok: {
    title: "TikTok Events API",
    description: "Sends SubmitForm and CompletePayment to TikTok Ads.",
    idLabel: "Pixel code",
    idHint: "TikTok Ads Manager → Events → Web events",
    tokenLabel: "Access token",
    test: true,
  },
  ga4: {
    title: "Google Analytics 4",
    description:
      "Sends generate_lead and purchase through the Measurement Protocol. Import them into Google Ads as conversions.",
    idLabel: "Measurement ID",
    idHint: "Admin → Data streams → your web stream",
    tokenLabel: "Measurement Protocol API secret",
    test: false,
  },
};

function PlatformCard({
  workspaceSlug,
  platform,
  current,
}: {
  workspaceSlug: string;
  platform: Platform;
  current: Current;
}) {
  const c = COPY[platform];
  const connected = Boolean(current.id && current.hasToken);
  const [id, setId] = useState(current.id ?? "");
  const [token, setToken] = useState("");
  const [testCode, setTestCode] = useState(current.testCode ?? "");
  const [busy, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? "Saved");
      setToken("");
      router.refresh();
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {c.title}
          {connected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2Icon className="size-3" /> Connected
            </span>
          )}
        </CardTitle>
        <CardDescription>{c.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveTrackingPlatform(workspaceSlug, platform, { id, token, testCode }));
          }}
        >
          <div className="space-y-2">
            <Label htmlFor={`${platform}-id`}>{c.idLabel}</Label>
            <Input id={`${platform}-id`} value={id} onChange={(e) => setId(e.target.value)} />
            <p className="text-xs text-muted-foreground">{c.idHint}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${platform}-token`}>{c.tokenLabel}</Label>
            <Input
              id={`${platform}-token`}
              type="password"
              autoComplete="off"
              placeholder={current.hasToken ? "•••••••• saved (leave empty to keep)" : ""}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Stored encrypted. Never shown again.</p>
          </div>
          {c.test && (
            <div className="space-y-2">
              <Label htmlFor={`${platform}-test`}>Test event code (optional)</Label>
              <Input id={`${platform}-test`} value={testCode} onChange={(e) => setTestCode(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Events then show under “Test events”. Remove it to go live.
              </p>
            </div>
          )}
          <div className="flex items-end justify-end gap-2 sm:col-span-2">
            {connected && (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Disconnect ${c.title}? Conversions stop being sent.`))
                    run(() => disconnectTrackingPlatform(workspaceSlug, platform));
                }}
              >
                Disconnect
              </Button>
            )}
            <Button type="submit" disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" />} {connected ? "Save" : "Connect"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function TrackingSettings({
  workspaceSlug,
  current,
}: {
  workspaceSlug: string;
  current: Record<Platform, Current>;
}) {
  return (
    <div className="space-y-6">
      {(["meta", "tiktok", "ga4"] as const).map((p) => (
        <PlatformCard key={p} workspaceSlug={workspaceSlug} platform={p} current={current[p]} />
      ))}
    </div>
  );
}
