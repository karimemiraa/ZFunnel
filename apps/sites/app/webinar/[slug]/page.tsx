import { upcomingSessions } from "@zfunnel/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Brand } from "@/app/brand";
import { currentWorkspace } from "@/lib/site";
import { publishedWebinar } from "@/lib/webinar";
import { RegisterForm } from "./register-form";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const ws = await currentWorkspace();
  const w = ws ? await publishedWebinar(ws.id, (await params).slug) : null;
  return w ? { title: `${w.title} · Free webinar`, description: w.description.slice(0, 160) } : { title: "Not found" };
}

export const dynamic = "force-dynamic";

export default async function WebinarRegistration({ params }: P) {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const w = await publishedWebinar(ws.id, (await params).slug);
  if (!w) notFound();
  // Same 10-minute grace as the register API, so late joiners can still get in.
  const sessions = upcomingSessions(w.schedule, w.timezone, new Date(), 4, 10);
  const points = w.description
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
  return (
    <main className="min-h-dvh bg-zinc-950 text-white">
      <header className="mx-auto flex h-16 max-w-5xl items-center px-4 [&_span]:text-white">
        <Brand ws={ws} />
      </header>
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-10 lg:grid-cols-[1.2fr_1fr] lg:py-16">
        <section>
          <p
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase"
            style={{ background: `${ws.brandColor}33`, color: "#fff" }}
          >
            <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
            {w.schedule.kind === "live" ? "Live event" : "Free online training"}
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">{w.title}</h1>
          {points.length > 0 && (
            <ul className="mt-8 space-y-3">
              {points.map((pt, i) => (
                <li key={i} className="flex gap-3 text-lg text-zinc-300">
                  <svg viewBox="0 0 20 20" className="mt-1 size-5 shrink-0" fill={ws.brandColor} aria-hidden>
                    <path d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.7-9.3a1 1 0 0 0-1.4-1.4L9 10.6 7.7 9.3a1 1 0 0 0-1.4 1.4l2 2a1 1 0 0 0 1.4 0l4-4Z" />
                  </svg>
                  {pt}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-8 text-sm text-zinc-400">
            {w.durationMinutes} minutes · Hosted by {ws.name}
          </p>
        </section>
        <section className="rounded-2xl bg-white p-6 text-zinc-900 shadow-2xl sm:p-8">
          {sessions.length ? (
            <RegisterForm
              slug={w.slug}
              color={ws.brandColor}
              sessions={sessions.map((s) => s.toISOString())}
              live={w.schedule.kind === "live"}
              serverNow={new Date().toISOString()}
            />
          ) : (
            <div className="py-10 text-center">
              <h2 className="text-xl font-bold">Registration is closed</h2>
              <p className="mt-2 text-zinc-500">There are no upcoming sessions right now.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
