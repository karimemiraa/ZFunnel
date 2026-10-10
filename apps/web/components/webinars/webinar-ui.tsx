"use client";

import type { WebinarScheduleJson } from "@zfunnel/db/schema";
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
import { cn } from "@zfunnel/ui/lib/utils";
import { NativeSelect } from "@zfunnel/ui/select";
import { Textarea } from "@zfunnel/ui/textarea";
import { toast } from "@zfunnel/ui/toaster";
import { parseVideoUrl, zonedToUtc } from "@zfunnel/shared";
import { intlLocale } from "@zfunnel/i18n";
import { useLocale, useT } from "@zfunnel/i18n/react";
import { Loader2Icon, PlusIcon, RocketIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createWebinar, deleteWebinar, saveWebinar, setWebinarStatus } from "@/lib/webinar-actions";

export function NewWebinar({ workspaceSlug, trigger }: { workspaceSlug: string; trigger: React.ReactNode }) {
  const router = useRouter();
  const t = useT();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("webinarsAdmin.newWebinar")}</DialogTitle>
          <DialogDescription>{t("webinarsAdmin.newDialogDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const title = String(new FormData(e.currentTarget).get("title"));
            start(async () => {
              const r = await createWebinar(workspaceSlug, title, Intl.DateTimeFormat().resolvedOptions().timeZone);
              if (!r.ok) return setError(r.error);
              router.push(`/${workspaceSlug}/webinars/${r.id}`);
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="wb-title">{t("webinarsAdmin.titleLabel")}</Label>
            <Input
              id="wb-title"
              name="title"
              placeholder={t("webinarsAdmin.titlePlaceholder")}
              required
              maxLength={120}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} {t("webinarsAdmin.createWebinar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Short weekday names (index 0 = Sunday) in the user's language; 2024-01-07 was a Sunday. */
function useDays() {
  const locale = useLocale();
  return useMemo(() => {
    const f = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "short", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 7 + i))));
  }, [locale]);
}

/** UTC ISO → "YYYY-MM-DDTHH:MM" in the given timezone (for datetime-local inputs). */
function toLocalInput(iso: string, tz: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
function fromLocalInput(v: string, tz: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v);
  return m ? zonedToUtc(+m[1]!, +m[2]!, +m[3]!, +m[4]!, +m[5]!, tz).toISOString() : "";
}

export type WebinarForm = {
  title: string;
  slug: string;
  description: string;
  videoUrl: string;
  timezone: string;
  durationMinutes: number;
  replayHours: number;
  schedule: WebinarScheduleJson;
  offerLabel: string;
  offerUrl: string;
  offerAtMinute: number | null;
  status: "draft" | "published";
};

export function WebinarSettings({
  workspaceSlug,
  id,
  initial,
  registrationUrl,
}: {
  workspaceSlug: string;
  id: string;
  initial: WebinarForm;
  registrationUrl: string;
}) {
  const router = useRouter();
  const t = useT();
  const DAYS = useDays();
  const [v, setV] = useState(initial);
  const [liveLocal, setLiveLocal] = useState(
    initial.schedule.kind === "live" ? toLocalInput(initial.schedule.startAt, initial.timezone) : "",
  );
  const [newTime, setNewTime] = useState("12:00");
  const [pending, start] = useTransition();
  const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  // The list can omit aliases such as "UTC"; always offer the saved value.
  const timezones = supported.includes(v.timezone) ? supported : [v.timezone, ...supported];
  const ev = v.schedule.kind === "evergreen" ? v.schedule : null;
  const video = v.videoUrl ? parseVideoUrl(v.videoUrl) : null;
  const run = (fn: () => Promise<{ ok: true; message?: string } | { ok: false; error: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(r.message ?? t("webinarsAdmin.saved"));
      after?.();
      router.refresh();
    });
  const payload = () => {
    const { status: _s, ...rest } = v;
    const schedule: WebinarScheduleJson =
      v.schedule.kind === "live" ? { kind: "live", startAt: fromLocalInput(liveLocal, v.timezone) } : v.schedule;
    return { ...rest, schedule };
  };

  return (
    <form
      className="grid gap-6 lg:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveWebinar(workspaceSlug, id, payload()));
      }}
    >
      <section className="grid content-start gap-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">{t("webinarsAdmin.details")}</h2>
        <div className="grid gap-2">
          <Label htmlFor="w-title">{t("webinarsAdmin.titleLabel")}</Label>
          <Input id="w-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="w-slug">{t("webinarsAdmin.registrationLink")}</Label>
          <div className="flex items-center gap-1 text-sm text-muted-foreground" dir="ltr">
            <span className="shrink-0">{registrationUrl.replace(/[^/]+$/, "")}</span>
            <Input id="w-slug" dir="ltr" value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="w-desc">{t("webinarsAdmin.learnLabel")}</Label>
          <Textarea
            id="w-desc"
            rows={4}
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
            placeholder={t("webinarsAdmin.learnPlaceholder")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="w-video">{t("webinarsAdmin.videoLink")}</Label>
          <Input
            id="w-video"
            dir="ltr"
            value={v.videoUrl}
            onChange={(e) => setV({ ...v, videoUrl: e.target.value })}
            placeholder={t("webinarsAdmin.videoPlaceholder")}
          />
          <p className={cn("text-xs", v.videoUrl && !video ? "text-destructive" : "text-muted-foreground")}>
            {v.videoUrl && !video
              ? t("webinarsAdmin.videoInvalid")
              : video
                ? `${video.kind === "file" ? t("webinarsAdmin.videoFile") : video.kind === "youtube" ? "YouTube" : "Vimeo"} ✓`
                : t("webinarsAdmin.videoLiveHint")}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="w-dur">{t("webinarsAdmin.length")}</Label>
            <Input
              id="w-dur"
              type="number"
              min={5}
              max={600}
              value={v.durationMinutes}
              onChange={(e) => setV({ ...v, durationMinutes: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="w-replay">{t("webinarsAdmin.replayHours")}</Label>
            <Input
              id="w-replay"
              type="number"
              min={0}
              max={720}
              value={v.replayHours}
              onChange={(e) => setV({ ...v, replayHours: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
      </section>

      <div className="grid content-start gap-6">
        <section className="grid gap-4 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">{t("webinarsAdmin.schedule")}</h2>
          <div className="inline-flex w-fit rounded-lg bg-muted p-1 text-sm">
            {(
              [
                ["evergreen", t("webinarsAdmin.modeEvergreen")],
                ["live", t("webinarsAdmin.modeLive")],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() =>
                  setV({
                    ...v,
                    schedule:
                      k === "live"
                        ? { kind: "live", startAt: "" }
                        : { kind: "evergreen", days: [1, 2, 3, 4, 5], times: ["11:00", "19:00"], justInTime: true },
                  })
                }
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium transition-all",
                  v.schedule.kind === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="w-tz">{t("webinarsAdmin.timezone")}</Label>
            <NativeSelect
              id="w-tz"
              dir="ltr"
              value={v.timezone}
              onChange={(e) => setV({ ...v, timezone: e.target.value })}
            >
              {timezones.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </NativeSelect>
          </div>
          {ev ? (
            <>
              <div className="grid gap-2">
                <span className="text-sm font-medium">{t("webinarsAdmin.days")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map((d, i) => {
                    const on = ev.days.includes(i);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setV({
                            ...v,
                            schedule: { ...ev, days: on ? ev.days.filter((x) => x !== i) : [...ev.days, i].sort() },
                          })
                        }
                        className={cn(
                          "rounded-md border px-2.5 py-1 text-sm font-medium transition-colors",
                          on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                        )}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid gap-2">
                <span className="text-sm font-medium">{t("webinarsAdmin.startTimes")}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {ev.times.map((tm) => (
                    <span key={tm} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm">
                      {tm}
                      <button
                        type="button"
                        aria-label={t("webinarsAdmin.removeTime", { time: tm })}
                        onClick={() => setV({ ...v, schedule: { ...ev, times: ev.times.filter((x) => x !== tm) } })}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </span>
                  ))}
                  <Input
                    type="time"
                    aria-label={t("webinarsAdmin.newStartTime")}
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="h-8 w-28"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      newTime &&
                      !ev.times.includes(newTime) &&
                      setV({ ...v, schedule: { ...ev, times: [...ev.times, newTime].sort() } })
                    }
                  >
                    <PlusIcon /> {t("webinarsAdmin.addTime")}
                  </Button>
                </div>
              </div>
              <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={ev.justInTime}
                  onChange={(e) => setV({ ...v, schedule: { ...ev, justInTime: e.target.checked } })}
                />
                <span>
                  <span className="font-medium">{t("webinarsAdmin.justInTime")}</span>
                  <span className="block text-muted-foreground">{t("webinarsAdmin.justInTimeHint")}</span>
                </span>
              </label>
            </>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="w-live">{t("webinarsAdmin.startsAt", { timezone: v.timezone })}</Label>
              <Input
                id="w-live"
                type="datetime-local"
                value={liveLocal}
                onChange={(e) => setLiveLocal(e.target.value)}
              />
            </div>
          )}
        </section>

        <section className="grid gap-4 rounded-xl border bg-card p-5">
          <div>
            <h2 className="font-semibold">{t("webinarsAdmin.offer")}</h2>
            <p className="text-sm text-muted-foreground">{t("webinarsAdmin.offerHint")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="w-offer-label">{t("webinarsAdmin.buttonText")}</Label>
              <Input
                id="w-offer-label"
                value={v.offerLabel}
                onChange={(e) => setV({ ...v, offerLabel: e.target.value })}
                placeholder={t("webinarsAdmin.buttonPlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="w-offer-min">{t("webinarsAdmin.showAfter")}</Label>
              <Input
                id="w-offer-min"
                type="number"
                min={0}
                max={600}
                value={v.offerAtMinute ?? 0}
                onChange={(e) => setV({ ...v, offerAtMinute: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="w-offer-url">{t("webinarsAdmin.link")}</Label>
            <Input
              id="w-offer-url"
              dir="ltr"
              value={v.offerUrl}
              onChange={(e) => setV({ ...v, offerUrl: e.target.value })}
              placeholder={t("webinarsAdmin.linkPlaceholder")}
            />
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 lg:col-span-2">
        <Button
          type="button"
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          onClick={() => {
            if (confirm(t("webinarsAdmin.confirmDelete", { title: initial.title })))
              run(
                () => deleteWebinar(workspaceSlug, id),
                () => router.push(`/${workspaceSlug}/webinars`),
              );
          }}
        >
          <Trash2Icon /> {t("webinarsAdmin.delete")}
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(() => setWebinarStatus(workspaceSlug, id, initial.status === "published" ? "draft" : "published"))
            }
          >
            <RocketIcon /> {initial.status === "published" ? t("webinarsAdmin.unpublish") : t("webinarsAdmin.publish")}
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2Icon className="animate-spin" />} {t("webinarsAdmin.saveChanges")}
          </Button>
        </div>
      </div>
    </form>
  );
}
