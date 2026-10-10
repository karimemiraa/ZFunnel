import { Button } from "@zfunnel/ui/button";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { PlusIcon, PresentationIcon } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { NewWebinar } from "@/components/webinars/webinar-ui";
import { requireWorkspace } from "@/lib/context";
import { siteOrigin } from "@/lib/urls";
import { listWebinars } from "@/lib/webinars";

export const metadata = { title: "Webinars" };

export default async function WebinarsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const ws = ctx.workspace.slug;
  const list = await listWebinars(ctx);
  const button = (
    <Button>
      <PlusIcon /> New webinar
    </Button>
  );
  return (
    <>
      <PageHeader
        title="Webinars"
        description="Automated and live webinars with registration, reminders, replays and a timed offer."
        actions={<NewWebinar workspaceSlug={ws} trigger={button} />}
      />
      {list.length === 0 ? (
        <EmptyState
          icon={<PresentationIcon />}
          title="Run your first webinar"
          description="Record once, sell every day: evergreen sessions run on a schedule while you sleep."
          action={<NewWebinar workspaceSlug={ws} trigger={button} />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map(({ w, registrants, attended }) => (
            <Link
              key={w.id}
              href={`/${ws}/webinars/${w.id}`}
              className="group rounded-xl border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <PresentationIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-semibold group-hover:underline">{w.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {w.schedule.kind === "live" ? "Live event" : "Evergreen"} · {w.durationMinutes} min ·{" "}
                    {w.status === "published" ? "Published" : "Draft"}
                  </p>
                </div>
              </div>
              <p className="mt-4 truncate text-xs text-muted-foreground">
                {`${siteOrigin(ws)}/webinar/${w.slug}`.replace(/^https?:\/\//, "")}
              </p>
              <p className="mt-1 text-sm font-medium">
                {registrants} registered · {attended} attended
                {registrants ? ` (${Math.round((attended / registrants) * 100)}%)` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
