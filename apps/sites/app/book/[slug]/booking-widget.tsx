"use client";

import {
  ArrowLeftIcon,
  CalendarCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  GlobeIcon,
  MapPinIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

type Props = {
  slug: string;
  name: string;
  description: string;
  location: string;
  duration: number;
  owner: string;
  slots: string[];
};

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function BookingWidget(p: Props) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const byDay = useMemo(() => {
    const m = new Map<string, Date[]>();
    for (const s of p.slots) {
      const d = new Date(s);
      const k = dayKey(d);
      m.set(k, [...(m.get(k) ?? []), d]);
    }
    return m;
  }, [p.slots]);
  const first = p.slots[0] ? new Date(p.slots[0]) : new Date();
  const [month, setMonth] = useState(new Date(first.getFullYear(), first.getMonth(), 1));
  const [day, setDay] = useState<string | null>(p.slots[0] ? dayKey(first) : null);
  const [slot, setSlot] = useState<Date | null>(null);
  const [state, setState] = useState<"pick" | "form" | "sending" | "done">("pick");
  const [error, setError] = useState("");
  const [booked, setBooked] = useState<Date | null>(null);

  const cells = useMemo(() => {
    const start = new Date(month);
    const lead = (start.getDay() + 6) % 7; // Monday first
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [
      ...Array(lead).fill(null),
      ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1)),
    ];
  }, [month]);
  const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const fmtLong = (d: Date) =>
    d.toLocaleString([], { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

  const info = (
    <div className="grid content-start gap-3 border-zinc-200 p-6 md:border-r">
      <p className="text-sm font-medium text-zinc-500">{p.owner}</p>
      <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
      <p className="flex items-center gap-2 text-sm text-zinc-600">
        <ClockIcon className="size-4" /> {p.duration} minutes
      </p>
      {p.location && (
        <p className="flex items-center gap-2 text-sm text-zinc-600">
          <MapPinIcon className="size-4" /> {p.location}
        </p>
      )}
      {slot && (
        <p className="flex items-center gap-2 text-sm font-medium text-indigo-700">
          <CalendarCheckIcon className="size-4" /> {fmtLong(slot)}
        </p>
      )}
      {p.description && <p className="mt-2 text-sm leading-6 whitespace-pre-line text-zinc-600">{p.description}</p>}
    </div>
  );

  if (state === "done" && booked)
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CalendarCheckIcon className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold">You're booked!</h1>
        <p className="mt-2 text-zinc-600">
          {p.name} on <strong>{fmtLong(booked)}</strong>
        </p>
        <p className="mt-1 text-sm text-zinc-500">A confirmation is on its way to your inbox.</p>
      </div>
    );

  return (
    <div className="mx-auto grid max-w-4xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm md:grid-cols-[280px_1fr]">
      {info}
      {state === "pick" ? (
        <div className="grid gap-6 p-6 sm:grid-cols-[1fr_180px]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">{month.toLocaleDateString([], { month: "long", year: "numeric" })}</h2>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Previous month"
                  className="rounded-lg p-1.5 hover:bg-zinc-100"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                >
                  <ChevronLeftIcon className="size-5" />
                </button>
                <button
                  type="button"
                  aria-label="Next month"
                  className="rounded-lg p-1.5 hover:bg-zinc-100"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                >
                  <ChevronRightIcon className="size-5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-400">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d} className="py-1">
                  {d}
                </span>
              ))}
              {cells.map((d, i) => {
                if (!d) return <span key={i} />;
                const k = dayKey(d);
                const has = byDay.has(k);
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!has}
                    aria-label={d.toDateString()}
                    aria-pressed={day === k}
                    onClick={() => setDay(k)}
                    className={`aspect-square rounded-full text-sm transition ${day === k ? "bg-indigo-600 font-semibold text-white" : has ? "bg-indigo-50 font-semibold text-indigo-700 hover:bg-indigo-100" : "text-zinc-300"}`}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
              <GlobeIcon className="size-3.5" /> Times shown in {tz}
            </p>
          </div>
          <div className="grid max-h-80 content-start gap-2 overflow-y-auto">
            {!p.slots.length && <p className="text-sm text-zinc-500">No times available right now.</p>}
            {(day ? (byDay.get(day) ?? []) : []).map((s) => (
              <button
                key={s.toISOString()}
                type="button"
                onClick={() => {
                  setSlot(s);
                  setState("form");
                }}
                className="rounded-xl border border-indigo-200 py-2.5 text-sm font-semibold text-indigo-700 transition hover:border-indigo-600 hover:bg-indigo-50"
              >
                {fmtTime(s)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <form
          className="grid content-start gap-4 p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setState("sending");
            setError("");
            const res = await fetch("/api/book", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                slug: p.slug,
                startAt: slot!.toISOString(),
                name: f.get("name"),
                email: f.get("email"),
                notes: f.get("notes") || undefined,
              }),
            });
            const json = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
              setError(json.error ?? "Something went wrong.");
              return setState(res.status === 409 ? "pick" : "form");
            }
            setBooked(slot);
            setState("done");
          }}
        >
          <button
            type="button"
            onClick={() => setState("pick")}
            className="inline-flex w-fit items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
          >
            <ArrowLeftIcon className="size-4" /> Back
          </button>
          <h2 className="text-lg font-semibold">Enter your details</h2>
          <label className="grid gap-1.5 text-sm font-medium">
            Name
            <input
              name="name"
              required
              autoComplete="name"
              className="h-11 rounded-xl border border-zinc-300 px-4 font-normal outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="h-11 rounded-xl border border-zinc-300 px-4 font-normal outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Anything we should know? (optional)
            <textarea
              name="notes"
              rows={3}
              className="rounded-xl border border-zinc-300 px-4 py-2.5 font-normal outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
            />
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={state === "sending"}
            className="h-12 rounded-xl bg-indigo-600 font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-60"
          >
            {state === "sending" ? "Booking…" : "Confirm booking"}
          </button>
        </form>
      )}
      {state === "pick" && error && (
        <p role="alert" className="col-span-full px-6 pb-4 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
