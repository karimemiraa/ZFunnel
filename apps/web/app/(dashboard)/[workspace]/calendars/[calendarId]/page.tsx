import { Button } from "@zfunnel/ui/button";
import { ArrowLeftIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingsTable } from "@/components/calendars/bookings-table";
import { CalendarSettings } from "@/components/calendars/calendar-ui";
import { PageHeader } from "@/components/page-header";
import { deleteCalendar } from "@/lib/calendar-actions";
import { getCalendar, listBookings } from "@/lib/calendars";
import { requireWorkspace } from "@/lib/context";
import { siteOrigin } from "@/lib/urls";

export const metadata = { title: "Calendar" };

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; calendarId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await requireWorkspace(params);
  const { calendarId } = await params;
  const { tab: raw } = await searchParams;
  const cal = await getCalendar(ctx, calendarId);
  if (!cal) notFound();
  const ws = ctx.workspace.slug;
  const tab = raw === "upcoming" || raw === "past" ? raw : "settings";
  const rows = tab === "settings" ? [] : await listBookings(ctx, { calendarId, past: tab === "past" });
  const base = `/${ws}/calendars/${calendarId}`;
  const bookingUrl = `${siteOrigin(ws)}/book/${cal.slug}`;
  return (
    <>
      <Link
        href={`/${ws}/calendars`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 rtl:-scale-x-100" /> Calendars
      </Link>
      <PageHeader
        title={cal.name}
        description={`${cal.durationMinutes}-minute bookings · ${cal.timezone}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href={bookingUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon /> Open booking page
              </a>
            </Button>
            <form action={deleteCalendar.bind(null, ws, calendarId)}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Delete calendar"
                className="hover:text-destructive"
              >
                <Trash2Icon />
              </Button>
            </form>
          </div>
        }
      />
      <nav className="mb-6 flex gap-1 border-b" aria-label="Calendar sections">
        {(["settings", "upcoming", "past"] as const).map((t) => (
          <Link
            key={t}
            href={t === "settings" ? base : `${base}?tab=${t}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize ${tab === t ? "border-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </Link>
        ))}
      </nav>
      {tab === "settings" ? (
        <CalendarSettings
          workspaceSlug={ws}
          bookingUrl={bookingUrl}
          calendar={{
            id: cal.id,
            name: cal.name,
            slug: cal.slug,
            description: cal.description,
            location: cal.location,
            durationMinutes: cal.durationMinutes,
            bufferMinutes: cal.bufferMinutes,
            minNoticeHours: cal.minNoticeHours,
            maxDaysAhead: cal.maxDaysAhead,
            timezone: cal.timezone,
            status: cal.status,
            availability: cal.availability,
          }}
        />
      ) : (
        <BookingsTable rows={rows} workspaceSlug={ws} />
      )}
    </>
  );
}
