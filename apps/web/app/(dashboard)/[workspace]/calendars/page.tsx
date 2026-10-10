import { Button } from "@zfunnel/ui/button";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { CalendarDaysIcon, ClockIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { BookingsTable } from "@/components/calendars/bookings-table";
import { NewCalendar } from "@/components/calendars/calendar-ui";
import { PageHeader } from "@/components/page-header";
import { listBookings, listCalendars } from "@/lib/calendars";
import { requireWorkspace } from "@/lib/context";
import { getT } from "@/lib/i18n";
import { siteOrigin } from "@/lib/urls";

export async function generateMetadata() {
  return { title: (await getT())("calendarsAdmin.title") };
}

export default async function CalendarsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const t = await getT();
  const ws = ctx.workspace.slug;
  const [cals, upcoming] = await Promise.all([listCalendars(ctx), listBookings(ctx)]);
  const button = (
    <Button>
      <PlusIcon /> {t("calendarsAdmin.newCalendar")}
    </Button>
  );
  return (
    <>
      <PageHeader
        title={t("calendarsAdmin.title")}
        description={t("calendarsAdmin.description")}
        actions={<NewCalendar workspaceSlug={ws} trigger={button} />}
      />
      {cals.length === 0 ? (
        <EmptyState
          icon={<CalendarDaysIcon />}
          title={t("calendarsAdmin.emptyTitle")}
          description={t("calendarsAdmin.emptyDescription")}
          action={<NewCalendar workspaceSlug={ws} trigger={button} />}
        />
      ) : (
        <div className="grid gap-8">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cals.map(({ c, upcoming: n }) => (
              <Link
                key={c.id}
                href={`/${ws}/calendars/${c.id}`}
                className="group rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarDaysIcon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold group-hover:underline">{c.name}</h3>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ClockIcon className="size-3" /> {t("calendarsAdmin.minutesShort", { count: c.durationMinutes })}{" "}
                      · {c.status === "active" ? t("calendarsAdmin.accepting") : t("calendarsAdmin.paused")}
                    </p>
                  </div>
                </div>
                <p className="mt-4 truncate text-xs text-muted-foreground" dir="ltr">
                  {`${siteOrigin(ws)}/book/${c.slug}`.replace(/^https?:\/\//, "")}
                </p>
                <p className="mt-1 text-sm font-medium">{t("calendarsAdmin.upcomingCount", { count: n })}</p>
              </Link>
            ))}
          </div>
          <section>
            <h2 className="mb-3 font-semibold">{t("calendarsAdmin.upcomingBookings")}</h2>
            <BookingsTable rows={upcoming} workspaceSlug={ws} showCalendar />
          </section>
        </div>
      )}
    </>
  );
}
