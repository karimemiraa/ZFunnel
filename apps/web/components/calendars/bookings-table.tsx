import { intlLocale } from "@zfunnel/i18n";
import { Badge } from "@zfunnel/ui/badge";
import Link from "next/link";
import type { listBookings } from "@/lib/calendars";
import { getLocale, getT } from "@/lib/i18n";
import { CancelBookingButton } from "./calendar-ui";

export async function BookingsTable({
  rows,
  workspaceSlug,
  showCalendar,
}: {
  rows: Awaited<ReturnType<typeof listBookings>>;
  workspaceSlug: string;
  showCalendar?: boolean;
}) {
  const t = await getT();
  const tag = intlLocale(await getLocale());
  if (!rows.length)
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {t("calendarsAdmin.noBookings")}
      </p>
    );
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3">{t("calendarsAdmin.colWhen")}</th>
            <th className="px-4 py-3">{t("calendarsAdmin.colWho")}</th>
            {showCalendar && <th className="px-4 py-3 max-md:hidden">{t("calendarsAdmin.colCalendar")}</th>}
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map(({ b, calendar, tz }) => (
            <tr key={b.id} className={b.status === "cancelled" ? "opacity-50" : undefined}>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="font-medium">
                  {b.startAt.toLocaleString(tag, {
                    timeZone: tz,
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                <div className="text-xs text-muted-foreground">{tz}</div>
              </td>
              <td className="px-4 py-3">
                {b.contactId ? (
                  <Link href={`/${workspaceSlug}/contacts/${b.contactId}`} className="font-medium hover:underline">
                    {b.name}
                  </Link>
                ) : (
                  <span className="font-medium">{b.name}</span>
                )}
                <div className="text-xs text-muted-foreground">{b.email}</div>
                {b.notes && <div className="mt-1 max-w-sm truncate text-xs text-muted-foreground">“{b.notes}”</div>}
              </td>
              {showCalendar && <td className="px-4 py-3 text-muted-foreground max-md:hidden">{calendar}</td>}
              <td className="px-4 py-3 text-end">
                {b.status === "cancelled" ? (
                  <Badge variant="secondary">{t("calendarsAdmin.cancelled")}</Badge>
                ) : (
                  b.startAt > new Date() && <CancelBookingButton workspaceSlug={workspaceSlug} id={b.id} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
