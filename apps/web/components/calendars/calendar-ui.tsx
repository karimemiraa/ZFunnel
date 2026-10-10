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
import { NativeSelect } from "@zfunnel/ui/select";
import { Textarea } from "@zfunnel/ui/textarea";
import { toast } from "@zfunnel/ui/toaster";
import type { Availability, Weekday } from "@zfunnel/shared";
import { intlLocale } from "@zfunnel/i18n";
import { useLocale, useT } from "@zfunnel/i18n/react";
import { Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { cancelBooking, createCalendar, saveCalendar } from "@/lib/calendar-actions";

export function NewCalendar({ workspaceSlug, trigger }: { workspaceSlug: string; trigger: React.ReactNode }) {
  const router = useRouter();
  const t = useT();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("calendarsAdmin.newDialogTitle")}</DialogTitle>
          <DialogDescription>{t("calendarsAdmin.newDialogDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name"));
            start(async () => {
              const r = await createCalendar(workspaceSlug, name, Intl.DateTimeFormat().resolvedOptions().timeZone);
              if (!r.ok) return setError(r.error);
              router.push(`/${workspaceSlug}/calendars/${r.id}`);
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="cal-name">{t("calendarsAdmin.name")}</Label>
            <Input
              id="cal-name"
              name="name"
              placeholder={t("calendarsAdmin.namePlaceholder")}
              required
              maxLength={80}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} {t("calendarsAdmin.createCalendar")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const DAY_KEYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Weekday names in the user's language (2024-01-01 was a Monday). */
function useDays() {
  const locale = useLocale();
  return useMemo(() => {
    const f = new Intl.DateTimeFormat(intlLocale(locale), { weekday: "long", timeZone: "UTC" });
    return DAY_KEYS.map((key, i) => ({ key, label: f.format(new Date(Date.UTC(2024, 0, 1 + i))) }));
  }, [locale]);
}

type Cal = {
  id: string;
  name: string;
  slug: string;
  description: string;
  location: string;
  durationMinutes: number;
  bufferMinutes: number;
  minNoticeHours: number;
  maxDaysAhead: number;
  timezone: string;
  status: "active" | "paused";
  availability: Availability;
};

export function CalendarSettings({
  workspaceSlug,
  calendar,
  bookingUrl,
}: {
  workspaceSlug: string;
  calendar: Cal;
  bookingUrl: string;
}) {
  const router = useRouter();
  const t = useT();
  const DAYS = useDays();
  const [v, setV] = useState(calendar);
  const [pending, start] = useTransition();
  const supported = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  // The list can omit aliases such as "UTC"; always offer the saved value.
  const timezones = supported.includes(v.timezone) ? supported : [v.timezone, ...supported];
  const num = (k: keyof Cal) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [k]: Math.max(0, Number(e.target.value) || 0) });
  const setDay = (d: Weekday, wins: { start: string; end: string }[]) =>
    setV({ ...v, availability: { ...v.availability, [d]: wins } });
  return (
    <form
      className="grid gap-6 lg:grid-cols-[1fr_1fr]"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const { id: _id, ...rest } = v;
          const r = await saveCalendar(workspaceSlug, calendar.id, rest);
          if (!r.ok) return void toast.error(r.error);
          toast.success(r.message ?? t("calendarsAdmin.saved"));
          router.refresh();
        });
      }}
    >
      <section className="grid content-start gap-4 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">{t("calendarsAdmin.details")}</h2>
        <div className="grid gap-2">
          <Label htmlFor="c-name">{t("calendarsAdmin.name")}</Label>
          <Input id="c-name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="c-slug">{t("calendarsAdmin.bookingLink")}</Label>
          <div className="flex items-center gap-1 text-sm text-muted-foreground" dir="ltr">
            <span className="shrink-0">{bookingUrl.replace(/[^/]+$/, "")}</span>
            <Input id="c-slug" dir="ltr" value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="c-desc">{t("calendarsAdmin.descriptionLabel")}</Label>
          <Textarea
            id="c-desc"
            rows={3}
            value={v.description}
            onChange={(e) => setV({ ...v, description: e.target.value })}
            placeholder={t("calendarsAdmin.descriptionPlaceholder")}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="c-loc">{t("calendarsAdmin.location")}</Label>
          <Input
            id="c-loc"
            value={v.location}
            onChange={(e) => setV({ ...v, location: e.target.value })}
            placeholder={t("calendarsAdmin.locationPlaceholder")}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="c-dur">{t("calendarsAdmin.duration")}</Label>
            <Input
              id="c-dur"
              type="number"
              min={5}
              max={480}
              value={v.durationMinutes}
              onChange={num("durationMinutes")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-buf">{t("calendarsAdmin.buffer")}</Label>
            <Input id="c-buf" type="number" min={0} max={240} value={v.bufferMinutes} onChange={num("bufferMinutes")} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-notice">{t("calendarsAdmin.minNotice")}</Label>
            <Input
              id="c-notice"
              type="number"
              min={0}
              max={720}
              value={v.minNoticeHours}
              onChange={num("minNoticeHours")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="c-ahead">{t("calendarsAdmin.maxAhead")}</Label>
            <Input id="c-ahead" type="number" min={1} max={365} value={v.maxDaysAhead} onChange={num("maxDaysAhead")} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="c-status">{t("calendarsAdmin.status")}</Label>
          <NativeSelect
            id="c-status"
            value={v.status}
            onChange={(e) => setV({ ...v, status: e.target.value as Cal["status"] })}
          >
            <option value="active">{t("calendarsAdmin.accepting")}</option>
            <option value="paused">{t("calendarsAdmin.paused")}</option>
          </NativeSelect>
        </div>
      </section>
      <section className="grid content-start gap-4 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">{t("calendarsAdmin.weeklyAvailability")}</h2>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="c-tz">{t("calendarsAdmin.timezone")}</Label>
          <NativeSelect
            id="c-tz"
            dir="ltr"
            value={v.timezone}
            onChange={(e) => setV({ ...v, timezone: e.target.value })}
          >
            {timezones.map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </NativeSelect>
        </div>
        <ul className="divide-y rounded-lg border">
          {DAYS.map(({ key, label }) => {
            const wins = v.availability[key] ?? [];
            return (
              <li key={key} className="flex flex-wrap items-start gap-3 px-3 py-2.5">
                <label className="flex w-32 items-center gap-2 pt-1.5 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={wins.length > 0}
                    onChange={(e) => setDay(key, e.target.checked ? [{ start: "09:00", end: "17:00" }] : [])}
                  />
                  {label}
                </label>
                <div className="grid flex-1 gap-1.5">
                  {wins.length === 0 && (
                    <span className="pt-1.5 text-sm text-muted-foreground">{t("calendarsAdmin.unavailable")}</span>
                  )}
                  {wins.map((w, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <Input
                        type="time"
                        className="w-28"
                        aria-label={t("calendarsAdmin.dayStart", { day: label })}
                        value={w.start}
                        onChange={(e) =>
                          setDay(
                            key,
                            wins.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)),
                          )
                        }
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        className="w-28"
                        aria-label={t("calendarsAdmin.dayEnd", { day: label })}
                        value={w.end}
                        onChange={(e) =>
                          setDay(
                            key,
                            wins.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)),
                          )
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={t("calendarsAdmin.removeTime")}
                        onClick={() =>
                          setDay(
                            key,
                            wins.filter((_, j) => j !== i),
                          )
                        }
                      >
                        <XIcon />
                      </Button>
                    </div>
                  ))}
                </div>
                {wins.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={t("calendarsAdmin.addTimeOn", { day: label })}
                    onClick={() => setDay(key, [...wins, { start: "13:00", end: "17:00" }])}
                  >
                    <PlusIcon />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />} {t("calendarsAdmin.saveCalendar")}
        </Button>
      </section>
    </form>
  );
}

export function CancelBookingButton({ workspaceSlug, id }: { workspaceSlug: string; id: string }) {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() =>
        confirm(t("calendarsAdmin.confirmCancel")) &&
        start(async () => {
          const r = await cancelBooking(workspaceSlug, id);
          if (r.ok) toast.success(r.message ?? t("calendarsAdmin.cancelledToast"));
          router.refresh();
        })
      }
    >
      {t("calendarsAdmin.cancel")}
    </Button>
  );
}
