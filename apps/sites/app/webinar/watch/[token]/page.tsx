import { parseVideoUrl } from "@zfunnel/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Brand } from "@/app/brand";
import { currentWorkspace } from "@/lib/site";
import { registrationByToken } from "@/lib/webinar";
import { WatchRoom } from "./watch-room";

type P = { params: Promise<{ token: string }> };

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Webinar", robots: { index: false } };

export default async function WatchPage({ params }: P) {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const row = await registrationByToken(ws.id, (await params).token);
  if (!row) notFound();
  const { r, w } = row;
  return (
    <main className="min-h-dvh bg-zinc-950 text-white">
      <header className="mx-auto flex h-16 max-w-6xl items-center px-4 [&_span]:text-white">
        <Brand ws={ws} />
      </header>
      <WatchRoom
        token={r.token}
        title={w.title}
        color={ws.brandColor}
        sessionAt={r.sessionAt.toISOString()}
        serverNow={new Date().toISOString()}
        durationMinutes={w.durationMinutes}
        replayHours={w.replayHours}
        realLive={w.schedule.kind === "live"}
        video={parseVideoUrl(w.videoUrl)}
        offer={
          w.offerLabel && w.offerUrl
            ? { label: w.offerLabel, url: w.offerUrl, atSeconds: (w.offerAtMinute ?? 0) * 60 }
            : null
        }
      />
    </main>
  );
}
