import { Button } from "@zfunnel/ui/button";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { WebinarSettings } from "@/components/webinars/webinar-ui";
import { requireWorkspace } from "@/lib/context";
import { timeAgo } from "@/lib/format";
import { siteOrigin } from "@/lib/urls";
import { getWebinar } from "@/lib/webinars";
import { MousePointerClickIcon, UserCheckIcon, UsersIcon } from "lucide-react";

export const metadata = { title: "Webinar" };

export default async function WebinarPage({ params }: { params: Promise<{ workspace: string; webinarId: string }> }) {
  const ctx = await requireWorkspace(params);
  const { webinarId } = await params;
  const data = await getWebinar(ctx, webinarId);
  if (!data) notFound();
  const { w, registrants } = data;
  const ws = ctx.workspace.slug;
  const url = `${siteOrigin(ws)}/webinar/${w.slug}`;
  const attended = registrants.filter((r) => r.attendedAt).length;
  const clicked = registrants.filter((r) => r.offerClickedAt).length;
  const fmt = (d: Date) => d.toLocaleString("en-US", { timeZone: w.timezone, dateStyle: "medium", timeStyle: "short" });
  return (
    <>
      <Link
        href={`/${ws}/webinars`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4" /> Webinars
      </Link>
      <PageHeader
        title={w.title}
        description={
          w.status === "published" ? "Published: people can register." : "Draft: publish it to open registration."
        }
        actions={
          w.status === "published" && (
            <Button variant="outline" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLinkIcon /> Registration page
              </a>
            </Button>
          )
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Registered" value={String(registrants.length)} icon={UsersIcon} />
        <StatCard
          label="Attended"
          value={String(attended)}
          hint={registrants.length ? `${Math.round((attended / registrants.length) * 100)}% show-up rate` : undefined}
          icon={UserCheckIcon}
        />
        <StatCard
          label="Clicked the offer"
          value={String(clicked)}
          hint={attended ? `${Math.round((clicked / attended) * 100)}% of attendees` : undefined}
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
        <h2 className="mb-3 font-semibold">Registrants</h2>
        {registrants.length === 0 ? (
          <p className="text-sm text-muted-foreground">No registrations yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Session ({w.timezone})</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right max-sm:hidden">Registered</th>
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
                        ? "Clicked offer"
                        : r.attendedAt
                          ? "Attended"
                          : r.sessionAt > new Date()
                            ? "Upcoming"
                            : "Missed"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground max-sm:hidden">{timeAgo(r.createdAt)}</td>
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
