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
import { getT } from "@/lib/i18n";
import { siteOrigin } from "@/lib/urls";

export async function generateMetadata() {
  return { title: (await getT())("calendarsAdmin.calendarTitle") };
}

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; calendarId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await requireWorkspace(params);
  const t = await getT();
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
        <ArrowLeftIcon className="size-4 rtl:-scale-x-100" /> {t("calendarsAdmin.title")}
      </Link>
      <PageHeader
        title={cal.name}
        description={t("calendarsAdmin.minuteBookings", { count: cal.durationMinutes, timezone: cal.timezone })}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href={bookingUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon /> {t("calendarsAdmin.openBookingPage")}
              </a>
            </Button>
            <form action={deleteCalendar.bind(null, ws, calendarId)}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label={t("calendarsAdmin.deleteCalendar")}
                className="hover:text-destructive"
              >
                <Trash2Icon />
              </Button>
            </form>
          </div>
        }
      />
      <nav className="mb-6 flex gap-1 border-b" aria-label={t("calendarsAdmin.sections")}>
        {(["settings", "upcoming", "past"] as const).map((k) => (
          <Link
            key={k}
            href={k === "settings" ? base : `${base}?tab=${k}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === k ? "border-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t(`calendarsAdmin.tabs.${k}`)}
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
