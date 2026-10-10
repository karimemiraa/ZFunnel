"use client";

import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { NativeSelect } from "@zfunnel/ui/select";
import { toast } from "@zfunnel/ui/toaster";
import {
  CalendarClockIcon,
  FlaskConicalIcon,
  Loader2Icon,
  PaletteIcon,
  SendIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { cancelSchedule, deleteBroadcast, saveBroadcastDraft, sendBroadcast, sendTestEmail } from "@/lib/email-actions";

type Props = {
  workspaceSlug: string;
  broadcastId: string;
  emailId: string;
  status: "draft" | "scheduled" | "sending" | "sent" | "failed";
  scheduledAt: string | null;
  initial: { name: string; subject: string; preheader: string; audience: string };
  initialCount: number;
  segments: { id: string; name: string }[];
  tags: string[];
};

function localInput(d: Date) {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function Composer(p: Props) {
  const [v, setV] = useState(p.initial);
  const [count, setCount] = useState(p.initialCount);
  const [saving, setSaving] = useState(false);
  const [pending, start] = useTransition();
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState(() => localInput(new Date(Date.now() + 3600_000)));
  const [previewKey, setPreviewKey] = useState(0);
  const editable = p.status === "draft";

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  // Autosave the compose fields shortly after typing stops.
  const update = (k: keyof typeof v, value: string) => {
    const next = { ...v, [k]: value };
    setV(next);
    setSaving(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await saveBroadcastDraft(p.workspaceSlug, p.broadcastId, next);
      setSaving(false);
      if (!r.ok) toast.error(r.error);
      else {
        if (r.count !== undefined) setCount(r.count);
        setPreviewKey((n) => n + 1);
      }
    }, 600);
  };
  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? "Done");
      else toast.error(r.error ?? "Something went wrong");
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="grid content-start gap-5">
        <section className="grid gap-4 rounded-xl border bg-card p-5">
          <div className="grid gap-2">
            <Label htmlFor="name">Internal name</Label>
            <Input id="name" value={v.name} onChange={(e) => update("name", e.target.value)} disabled={!editable} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="subject">Subject line</Label>
            <Input
              id="subject"
              value={v.subject}
              onChange={(e) => update("subject", e.target.value)}
              disabled={!editable}
              placeholder="Your free guide is inside"
            />
            <p className="text-xs text-muted-foreground">Personalize with {"{{first_name|there}}"}.</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="preheader">Preview text</Label>
            <Input
              id="preheader"
              value={v.preheader}
              onChange={(e) => update("preheader", e.target.value)}
              disabled={!editable}
              placeholder="Shown after the subject in most inboxes"
            />
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border bg-card p-5">
          <Label htmlFor="audience">Audience</Label>
          <NativeSelect
            id="audience"
            value={v.audience}
            onChange={(e) => update("audience", e.target.value)}
            disabled={!editable}
          >
            <option value="all">All subscribed contacts</option>
            {p.segments.length > 0 && (
              <optgroup label="Segments">
                {p.segments.map((s) => (
                  <option key={s.id} value={`segment:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            )}
            {p.tags.length > 0 && (
              <optgroup label="Tags">
                {p.tags.map((t) => (
                  <option key={t} value={`tag:${t}`}>
                    Tagged “{t}”
                  </option>
                ))}
              </optgroup>
            )}
          </NativeSelect>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <UsersIcon className="size-4" />
            <span>
              <strong className="text-foreground tabular-nums">{count.toLocaleString()}</strong> subscribed{" "}
              {count === 1 ? "contact" : "contacts"}
            </span>
          </p>
        </section>

        {editable ? (
          <section className="grid gap-3 rounded-xl border bg-card p-5">
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending || saving}
                onClick={() => run(() => sendBroadcast(p.workspaceSlug, p.broadcastId, null))}
              >
                {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Send now
              </Button>
              <Button variant="outline" onClick={() => setScheduling((s) => !s)}>
                <CalendarClockIcon /> Schedule
              </Button>
              <Button
                variant="ghost"
                disabled={pending || saving}
                onClick={() => run(() => sendTestEmail(p.workspaceSlug, p.broadcastId))}
              >
                <FlaskConicalIcon /> Send test
              </Button>
            </div>
            {scheduling && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid flex-1 gap-1.5">
                  <Label htmlFor="when" className="text-xs">
                    Send at (your time)
                  </Label>
                  <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                </div>
                <Button
                  disabled={pending}
                  onClick={() => run(() => sendBroadcast(p.workspaceSlug, p.broadcastId, new Date(when).toISOString()))}
                >
                  Schedule
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{saving ? "Saving…" : "All changes saved"}</p>
          </section>
        ) : p.status === "scheduled" ? (
          <section className="flex items-center justify-between gap-3 rounded-xl border bg-card p-5 text-sm">
            <span>
              Scheduled for <strong>{p.scheduledAt ? new Date(p.scheduledAt).toLocaleString() : "now"}</strong>
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => cancelSchedule(p.workspaceSlug, p.broadcastId))}
            >
              <XIcon /> Cancel
            </Button>
          </section>
        ) : null}

        {p.status !== "sending" && (
          <form
            action={deleteBroadcast.bind(null, p.workspaceSlug, p.broadcastId)}
            onSubmit={(e) => {
              if (!confirm("Delete this broadcast? Its stats will be lost.")) e.preventDefault();
            }}
          >
            <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
              <Trash2Icon /> Delete broadcast
            </Button>
          </form>
        )}
      </div>

      <div className="flex min-h-[640px] flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{v.subject || "No subject"}</p>
            <p className="truncate text-xs text-muted-foreground">{v.preheader || "Preview text"}</p>
          </div>
          {editable && (
            <Button size="sm" asChild>
              <Link href={`/email-editor/${p.workspaceSlug}/${p.emailId}?b=${p.broadcastId}`}>
                <PaletteIcon /> Design email
              </Link>
            </Button>
          )}
        </div>
        <iframe
          key={previewKey}
          title="Email preview"
          src={`/email-preview/${p.workspaceSlug}/${p.emailId}`}
          className="w-full flex-1 bg-white"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
