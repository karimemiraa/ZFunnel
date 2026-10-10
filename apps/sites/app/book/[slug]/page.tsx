import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { calendarBySlug, freeSlots } from "@/lib/booking";
import { currentWorkspace } from "@/lib/site";
import { BookingWidget } from "./booking-widget";
import { getT } from "@/lib/i18n";

type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const ws = await currentWorkspace();
  const cal = ws ? await calendarBySlug(ws.id, (await params).slug) : null;
  const t = await getT();
  return {
    title: cal ? `${cal.name} · ${ws!.name}` : t("booking.metaTitle"),
    description: cal?.description || undefined,
  };
}

export default async function BookPage({ params }: P) {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const cal = await calendarBySlug(ws.id, (await params).slug);
  if (!cal) notFound();
  const slots = (await freeSlots(cal)).map((d) => d.toISOString());
  return (
    <main className="min-h-dvh bg-gradient-to-b from-indigo-50/60 to-zinc-50 px-4 py-10 text-zinc-900 sm:py-16">
      <BookingWidget
        slug={cal.slug}
        name={cal.name}
        description={cal.description}
        location={cal.location}
        duration={cal.durationMinutes}
        owner={ws.name}
        slots={slots}
      />
    </main>
  );
}
