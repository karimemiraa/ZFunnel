import { intlLocale } from "@zfunnel/i18n";
import { Button } from "@zfunnel/ui/button";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { WebinarSettings } from "@/components/webinars/webinar-ui";
import { requireWorkspace } from "@/lib/context";
import { getFmt, getLocale, getT } from "@/lib/i18n";
import { siteOrigin } from "@/lib/urls";
import { getWebinar } from "@/lib/webinars";
import { MousePointerClickIcon, UserCheckIcon, UsersIcon } from "lucide-react";

export async function generateMetadata() {
  return { title: (await getT())("webinarsAdmin.webinarTitle") };
}

export default async function WebinarPage({ params }: { params: Promise<{ workspace: string; webinarId: string }> }) {
  const ctx = await requireWorkspace(params);
  const t = await getT();
  const f = await getFmt();
  const tag = intlLocale(await getLocale());
  const { webinarId } = await params;
  const data = await getWebinar(ctx, webinarId);
  if (!data) notFound();
  const { w, registrants } = data;
  const ws = ctx.workspace.slug;
  const url = `${siteOrigin(ws)}/webinar/${w.slug}`;
  const attended = registrants.filter((r) => r.attendedAt).length;
  const clicked = registrants.filter((r) => r.offerClickedAt).length;
  const fmt = (d: Date) => d.toLocaleString(tag, { timeZone: w.timezone, dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <Link
        href={`/${ws}/webinars`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 rtl:-scale-x-100" /> {t("webinarsAdmin.title")}
      </Link>
      <PageHeader
        title={w.title}
        description={w.status === "published" ? t("webinarsAdmin.publishedHint") : t("webinarsAdmin.draftHint")}
        actions={
          w.status === "published" && (
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLinkIcon /> {t("webinarsAdmin.registrationPage")}
              </a>
            </Button>
          )
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label={t("webinarsAdmin.statRegistered")} value={String(registrants.length)} icon={UsersIcon} />
        <StatCard
          label={t("webinarsAdmin.statAttended")}
          value={String(attended)}
          hint={
            registrants.length
              ? t("webinarsAdmin.showUpRate", { percent: Math.round((attended / registrants.length) * 100) })
              : undefined
          }
          icon={UserCheckIcon}
        />
        <StatCard
          label={t("webinarsAdmin.statClicked")}
          value={String(clicked)}
          hint={
            attended ? t("webinarsAdmin.ofAttendees", { percent: Math.round((clicked / attended) * 100) }) : undefined
          }
          icon={MousePointerClickIcon}
        />
      </div>
      <WebinarSettings
        workspaceSlug={ws}
        id={w.id}
        registrationUrl={url}
        initial={{
          title: w.title,
          slug: w.slug,
          description: w.description,
          videoUrl: w.videoUrl,
          timezone: w.timezone,
          durationMinutes: w.durationMinutes,
          replayHours: w.replayHours,
          schedule: w.schedule,
          offerLabel: w.offerLabel ?? "",
          offerUrl: w.offerUrl ?? "",
          offerAtMinute: w.offerAtMinute,
          status: w.status,
        }}
      />
      <section className="mt-8">
        <h2 className="mb-3 font-semibold">{t("webinarsAdmin.registrants")}</h2>
        {registrants.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("webinarsAdmin.noRegistrations")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">{t("webinarsAdmin.colName")}</th>
                  <th className="px-4 py-3">{t("webinarsAdmin.colSession", { timezone: w.timezone })}</th>
                  <th className="px-4 py-3">{t("webinarsAdmin.colStatus")}</th>
                  <th className="px-4 py-3 text-end max-sm:hidden">{t("webinarsAdmin.colRegistered")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {registrants.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3">
                      <Link href={`/${ws}/contacts/${r.contactId}`} className="font-medium hover:underline">
                        {r.name || r.email}
                      </Link>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-4 py-3">{fmt(r.sessionAt)}</td>
                    <td className="px-4 py-3">
                      {r.offerClickedAt
                        ? t("webinarsAdmin.statusClicked")
                        : r.attendedAt
                          ? t("webinarsAdmin.statusAttended")
                          : r.sessionAt > new Date()
                            ? t("webinarsAdmin.statusUpcoming")
                            : t("webinarsAdmin.statusMissed")}
                    </td>
                    <td className="px-4 py-3 text-end text-muted-foreground max-sm:hidden">{f.timeAgo(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
