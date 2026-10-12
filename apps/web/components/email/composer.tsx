"use client";

import { useT } from "@zfunnel/i18n/react";
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
  SparklesIcon,
  Trash2Icon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { aiRewrite } from "@/lib/ai-actions";
import { useFmt } from "@/lib/use-fmt";
import { useEffect, useRef, useState, useTransition } from "react";
import { DeleteDialog } from "@/components/records/delete-dialog";
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
  aiEnabled: boolean;
};

/** Renders `<b>…</b>` in a translated string as <strong>. */
const rich = (s: string, className?: string) =>
  s.split(/<b>(.*?)<\/b>/).map((part, i) =>
    i % 2 ? (
      <strong key={i} className={className}>
        {part}
      </strong>
    ) : (
      part
    ),
  );

function localInput(d: Date) {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export function Composer(p: Props) {
  const t = useT();
  const f = useFmt();
  const [v, setV] = useState(p.initial);
  const [count, setCount] = useState(p.initialCount);
  const [saving, setSaving] = useState(false);
  const [pending, start] = useTransition();
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState(() => localInput(new Date(Date.now() + 3600_000)));
  const [previewKey, setPreviewKey] = useState(0);
  const [suggesting, setSuggesting] = useState(false);
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
      if (r.ok) toast.success(r.message ?? t("email.composer.done"));
      else toast.error(r.error ?? t("email.actions.somethingWrong"));
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
      <div className="grid content-start gap-5">
        <section className="grid gap-4 rounded-xl border bg-card p-5">
          <div className="grid gap-2">
            <Label htmlFor="name">{t("email.composer.internalName")}</Label>
            <Input id="name" value={v.name} onChange={(e) => update("name", e.target.value)} disabled={!editable} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="subject">{t("email.composer.subjectLine")}</Label>
              {p.aiEnabled && editable && (
                <button
                  type="button"
                  disabled={suggesting}
                  className="inline-flex items-center gap-1 text-xs font-medium text-violet-600 hover:text-violet-500 disabled:opacity-50"
                  onClick={async () => {
                    setSuggesting(true);
                    const r = await aiRewrite(p.workspaceSlug, {
                      format: "plain",
                      role: "email subject",
                      text: v.subject,
                      instruction: v.subject
                        ? t("email.composer.aiImprove")
                        : t("email.composer.aiWrite", { name: v.name }),
                      context: "marketing email",
                    });
                    setSuggesting(false);
                    if (r.ok) update("subject", r.text);
                    else toast.error(r.error);
                  }}
                >
                  {suggesting ? <Loader2Icon className="size-3 animate-spin" /> : <SparklesIcon className="size-3" />}{" "}
                  {t("email.composer.suggest")}
                </button>
              )}
            </div>
            <Input
              id="subject"
              value={v.subject}
              onChange={(e) => update("subject", e.target.value)}
              disabled={!editable}
              placeholder={t("email.composer.subjectPlaceholder")}
            />
            <p className="text-xs text-muted-foreground">
              {t("email.composer.personalize", { tag: "{{first_name|there}}" })}
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="preheader">{t("email.composer.previewText")}</Label>
            <Input
              id="preheader"
              value={v.preheader}
              onChange={(e) => update("preheader", e.target.value)}
              disabled={!editable}
              placeholder={t("email.composer.preheaderPlaceholder")}
            />
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border bg-card p-5">
          <Label htmlFor="audience">{t("email.composer.audience")}</Label>
          <NativeSelect
            id="audience"
            value={v.audience}
            onChange={(e) => update("audience", e.target.value)}
            disabled={!editable}
          >
            <option value="all">{t("email.composer.allContacts")}</option>
            {p.segments.length > 0 && (
              <optgroup label={t("email.composer.segments")}>
                {p.segments.map((s) => (
                  <option key={s.id} value={`segment:${s.id}`}>
                    {s.name}
                  </option>
                ))}
              </optgroup>
            )}
            {p.tags.length > 0 && (
              <optgroup label={t("email.composer.tags")}>
                {p.tags.map((tag) => (
                  <option key={tag} value={`tag:${tag}`}>
                    {t("email.composer.tagged", { tag })}
                  </option>
                ))}
              </optgroup>
            )}
          </NativeSelect>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <UsersIcon className="size-4" />
            <span>{rich(t("email.composer.subscribedContacts", { count }), "text-foreground tabular-nums")}</span>
          </p>
        </section>

        {editable ? (
          <section className="grid gap-3 rounded-xl border bg-card p-5">
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={pending || saving}
                onClick={() => run(() => sendBroadcast(p.workspaceSlug, p.broadcastId, null))}
              >
                {pending ? <Loader2Icon className="animate-spin" /> : <SendIcon />} {t("email.composer.sendNow")}
              </Button>
              <Button variant="outline" onClick={() => setScheduling((s) => !s)}>
                <CalendarClockIcon /> {t("email.composer.schedule")}
              </Button>
              <Button
                variant="ghost"
                disabled={pending || saving}
                onClick={() => run(() => sendTestEmail(p.workspaceSlug, p.broadcastId))}
              >
                <FlaskConicalIcon /> {t("email.composer.sendTest")}
              </Button>
            </div>
            {scheduling && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="grid flex-1 gap-1.5">
                  <Label htmlFor="when" className="text-xs">
                    {t("email.composer.sendAt")}
                  </Label>
                  <Input id="when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
                </div>
                <Button
                  disabled={pending}
                  onClick={() => run(() => sendBroadcast(p.workspaceSlug, p.broadcastId, new Date(when).toISOString()))}
                >
                  {t("email.composer.schedule")}
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {saving ? t("email.composer.saving") : t("email.composer.allSaved")}
            </p>
          </section>
        ) : p.status === "scheduled" ? (
          <section className="flex items-center justify-between gap-3 rounded-xl border bg-card p-5 text-sm">
            <span>
              {rich(
                t("email.composer.scheduledFor", {
                  when: p.scheduledAt ? f.dateTime(p.scheduledAt) : t("email.composer.now"),
                }),
              )}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => cancelSchedule(p.workspaceSlug, p.broadcastId))}
            >
              <XIcon /> {t("email.composer.cancel")}
            </Button>
          </section>
        ) : null}

        {p.status !== "sending" && (
          <DeleteDialog
            workspaceSlug={p.workspaceSlug}
            usedInKind="email"
            id={p.emailId}
            name={v.name || t("email.composer.deleteBroadcast")}
            undoable={false}
            onConfirm={() => deleteBroadcast(p.workspaceSlug, p.broadcastId)}
            trigger={
              <Button type="button" variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                <Trash2Icon /> {t("email.composer.deleteBroadcast")}
              </Button>
            }
          />
        )}
      </div>

      <div className="flex min-h-[640px] flex-col overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{v.subject || t("email.composer.noSubject")}</p>
            <p className="truncate text-xs text-muted-foreground">{v.preheader || t("email.composer.previewText")}</p>
          </div>
          {editable && (
            <Button size="sm" asChild>
              <Link href={`/email-editor/${p.workspaceSlug}/${p.emailId}?b=${p.broadcastId}`}>
                <PaletteIcon /> {t("email.composer.designEmail")}
              </Link>
            </Button>
          )}
        </div>
        <iframe
          key={previewKey}
          title={t("email.composer.previewTitle")}
          src={`/email-preview/${p.workspaceSlug}/${p.emailId}`}
          className="w-full flex-1 bg-white"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
