"use client";

import { useSyncExternalStore } from "react";

type Props = {
  mode: "date" | "evergreen";
  date: string;
  minutes: number;
  storageKey: string;
  style: "boxes" | "inline";
  expiredText: string;
};

function remaining(target: number, nowMs: number) {
  const ms = Math.max(0, target - nowMs);
  return {
    ms,
    d: Math.floor(ms / 864e5),
    h: Math.floor(ms / 36e5) % 24,
    m: Math.floor(ms / 6e4) % 60,
    s: Math.floor(ms / 1e3) % 60,
  };
}

/** Per-visitor deadline, remembered in localStorage (falls back to memory if storage is blocked). */
const memoryTargets = new Map<string, number>();
function evergreenTarget(key: string, minutes: number) {
  const k = `zf-cd-${key}-${minutes}`;
  try {
    const saved = Number(localStorage.getItem(k));
    if (saved > 0) return saved;
    const t = Date.now() + minutes * 6e4;
    localStorage.setItem(k, String(t));
    return t;
  } catch {
    if (!memoryTargets.has(k)) memoryTargets.set(k, Date.now() + minutes * 6e4);
    return memoryTargets.get(k)!;
  }
}

/** One shared 1-second clock; `null` during SSR so server and first client render match. */
function subscribeClock(cb: () => void) {
  const id = setInterval(cb, 1000);
  return () => clearInterval(id);
}
const getNow = () => Math.floor(Date.now() / 1000);
const getServerNull = () => null;
const subscribeNever = () => () => {};

export function CountdownView({ mode, date, minutes, storageKey, style, expiredText }: Props) {
  const now = useSyncExternalStore(subscribeClock, getNow, getServerNull);
  // The deadline is a stable value read once on the client (evergreen) or parsed from the setting.
  const target = useSyncExternalStore(
    subscribeNever,
    () => (mode === "evergreen" ? evergreenTarget(storageKey, minutes) : Date.parse(date) || 0),
    getServerNull,
  );

  const r = target === null || now === null ? null : remaining(target, now * 1000);
  if (r && r.ms === 0 && expiredText) return <p className="text-center text-lg font-semibold">{expiredText}</p>;
  const parts: [string, number | null][] = [
    ["Days", r?.d ?? null],
    ["Hours", r?.h ?? null],
    ["Minutes", r?.m ?? null],
    ["Seconds", r?.s ?? null],
  ];
  const shown = r && r.d === 0 ? parts.slice(1) : parts;

  if (style === "inline")
    return (
      <p className="text-center text-lg font-semibold tabular-nums" style={{ color: "var(--zf-primary)" }}>
        {shown.map(([l, v]) => `${v === null ? "--" : String(v).padStart(2, "0")}${l[0]!.toLowerCase()}`).join(" : ")}
      </p>
    );

  return (
    <div className="flex justify-center gap-2.5 sm:gap-4" role="timer" aria-live="off">
      {shown.map(([label, v]) => (
        <div
          key={label}
          className="flex w-[4.5rem] flex-col items-center rounded-[var(--zf-radius)] py-3 sm:w-24 sm:py-4"
          style={{
            background: "color-mix(in srgb, var(--zf-fg) 6%, var(--zf-bg))",
            border: "1px solid color-mix(in srgb, var(--zf-fg) 10%, transparent)",
          }}
        >
          <span
            className="text-3xl font-extrabold tabular-nums sm:text-5xl"
            style={{ fontFamily: "var(--zf-heading-font)" }}
          >
            {v === null ? "--" : String(v).padStart(2, "0")}
          </span>
          <span className="mt-1 text-[10px] font-semibold tracking-widest uppercase opacity-60 sm:text-xs">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
