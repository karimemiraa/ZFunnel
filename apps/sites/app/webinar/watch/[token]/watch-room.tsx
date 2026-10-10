"use client";

import type { VideoSource } from "@zfunnel/shared";
import { webinarPhase } from "@zfunnel/shared";
import { useIntlLocale, useT } from "@zfunnel/i18n/react";
import { useEffect, useRef, useState } from "react";

type Props = {
  token: string;
  title: string;
  color: string;
  sessionAt: string;
  serverNow: string;
  durationMinutes: number;
  replayHours: number;
  /** One-time live stream: never seek, the stream is already live. */
  realLive: boolean;
  video: VideoSource | null;
  offer: { label: string; url: string; atSeconds: number } | null;
};

const post = (token: string, action: "attend" | "offer") =>
  fetch("/api/webinar/attend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, action }),
    keepalive: true,
  }).catch(() => null);

function Player({ video, start, live, title }: { video: VideoSource; start: number; live: boolean; title: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  if (video.kind === "file")
    return (
      <video
        ref={ref}
        src={video.url}
        autoPlay
        playsInline
        controls={!live}
        onLoadedMetadata={() => {
          if (ref.current && start > 0) ref.current.currentTime = start;
        }}
        className="size-full bg-black"
      />
    );
  const src =
    video.kind === "youtube"
      ? `https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&start=${start}&controls=${live ? 0 : 1}&disablekb=${live ? 1 : 0}`
      : `https://player.vimeo.com/video/${video.id}?autoplay=1&controls=${live ? 0 : 1}#t=${start}s`;
  return (
    <iframe
      src={src}
      title={title}
      allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
      allowFullScreen
      className="size-full border-0"
    />
  );
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function WatchRoom(p: Props) {
  const t = useT();
  const tag = useIntlLocale();
  const [now, setNow] = useState(() => new Date(p.serverNow));
  const [joined, setJoined] = useState<number | null>(null);
  const attended = useRef(false);
  // Ticks on the server's clock, so a wrong device clock can't skip ahead.
  useEffect(() => {
    const server = new Date(p.serverNow).getTime();
    const base = Date.now();
    const t = setInterval(() => setNow(new Date(server + (Date.now() - base))), 1000);
    return () => clearInterval(t);
  }, [p.serverNow]);

  const at = new Date(p.sessionAt);
  const { phase, elapsedSeconds } = webinarPhase(at, p.durationMinutes, p.replayHours, now);
  const replay = phase === "replay";
  const live = phase === "live";
  const offerVisible = !!p.offer && (replay || (live && elapsedSeconds >= p.offer.atSeconds));

  const join = () => {
    setJoined(live && !p.realLive ? Math.max(0, elapsedSeconds) : 0);
    if (!attended.current) {
      attended.current = true;
      void post(p.token, "attend");
    }
  };

  const when = at.toLocaleString(tag, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const left = Math.max(0, -elapsedSeconds);
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;
  const gcalStamp = (x: Date) =>
    x
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(p.title)}&dates=${gcalStamp(at)}/${gcalStamp(new Date(at.getTime() + p.durationMinutes * 60_000))}`;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {live && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold tracking-wide uppercase">
            <span className="size-1.5 animate-pulse rounded-full bg-white" /> {t("webinar.live")}
          </span>
        )}
        {replay && (
          <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs font-bold tracking-wide uppercase">
            {t("webinar.replay")}
          </span>
        )}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{p.title}</h1>
      </div>

      <div className="relative aspect-video overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl ring-1 ring-white/10">
        {phase === "waiting" && (
          <div className="flex size-full flex-col items-center justify-center p-6 text-center">
            <p className="text-sm font-semibold tracking-wide text-zinc-400 uppercase">{t("webinar.registered")}</p>
            <p className="mt-2 text-lg text-zinc-300" suppressHydrationWarning>
              {when}
            </p>
            <div className="mt-6 flex gap-3 sm:gap-5" aria-label={t("webinar.timeUntil")}>
              {(d ? [[d, t("webinar.days")]] : [])
                .concat([
                  [h, t("webinar.hours")],
                  [m, t("webinar.minutes")],
                  [s, t("webinar.seconds")],
                ] as [number, string][])
                .map(([n, label]) => (
                  <div key={label} className="w-16 rounded-xl bg-white/5 py-3 sm:w-20">
                    <div className="text-3xl font-bold tabular-nums sm:text-4xl" suppressHydrationWarning>
                      {pad(n as number)}
                    </div>
                    <div className="text-[11px] text-zinc-400 uppercase">{label}</div>
                  </div>
                ))}
            </div>
            <a
              href={gcal}
              target="_blank"
              rel="noreferrer"
              className="mt-6 text-sm font-medium underline-offset-4 hover:underline"
              style={{ color: p.color }}
            >
              {t("webinar.addToCalendar")}
            </a>
            <p className="mt-2 text-xs text-zinc-500">{t("webinar.keepOpen")}</p>
          </div>
        )}
        {(live || replay) &&
          (joined === null ? (
            <button
              type="button"
              onClick={join}
              className="group flex size-full flex-col items-center justify-center gap-4"
            >
              <span
                className="flex size-20 items-center justify-center rounded-full shadow-2xl transition group-hover:scale-105"
                style={{ background: p.color }}
              >
                <svg viewBox="0 0 24 24" className="ms-1 size-9" fill="white" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span className="text-lg font-semibold">{live ? t("webinar.joinNow") : t("webinar.watchReplay")}</span>
            </button>
          ) : p.video ? (
            <Player video={p.video} start={joined} live={live && !p.realLive} title={t("webinar.webinar")} />
          ) : (
            <div className="flex size-full items-center justify-center text-zinc-400">
              {t("webinar.videoUnavailable")}
            </div>
          ))}
        {phase === "ended" && (
          <div className="flex size-full flex-col items-center justify-center p-6 text-center">
            <h2 className="text-2xl font-bold">{t("webinar.ended")}</h2>
            <p className="mt-2 text-zinc-400">{t("webinar.replayGone")}</p>
          </div>
        )}
      </div>

      {offerVisible && p.offer && (
        <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl bg-white p-5 text-zinc-900 shadow-xl sm:flex-row">
          <p className="text-lg font-semibold">{t("webinar.specialOffer")}</p>
          <a
            href={p.offer.url}
            onClick={() => void post(p.token, "offer")}
            className="w-full rounded-lg px-6 py-3 text-center font-semibold text-white shadow-lg transition hover:brightness-110 sm:w-auto"
            style={{ background: p.color }}
          >
            {t("webinar.offerButton", { label: p.offer.label })}
          </a>
        </div>
      )}
    </div>
  );
}
