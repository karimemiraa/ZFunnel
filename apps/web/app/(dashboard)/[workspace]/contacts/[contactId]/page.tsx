import { Badge } from "@zfunnel/ui/badge";
import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { navText } from "@/lib/nav";
import { notFound } from "next/navigation";
import { ContactProfile, NoteForm } from "@/components/crm/contact-profile";
import { EnrollMenu } from "@/components/automations/enroll-menu";
import { Timeline } from "@/components/records/timeline";
import { listWorkflows } from "@/lib/automations";
import { requireWorkspace } from "@/lib/context";
import { getContactDetail } from "@/lib/crm";
import { getFmt, getT } from "@/lib/i18n";
import { getContactTimeline } from "@/lib/records";
import { canManage } from "@/lib/workspaces";

export default async function ContactPage({ params }: { params: Promise<{ workspace: string; contactId: string }> }) {
  const ctx = await requireWorkspace(params);
  const { contactId } = await params;
  const [data, workflows, timeline] = await Promise.all([
    getContactDetail(ctx, contactId),
    listWorkflows(ctx),
    getContactTimeline(ctx, contactId),
  ]);
  if (!data) notFound();
  const { contact: c } = data;
  const ws = ctx.workspace.slug;
  const [t, f] = await Promise.all([getT(), getFmt()]);
  const spent = data.orders
    .filter((o) => o.status === "paid" || o.status === "partially_refunded")
    .reduce((s, o) => s + o.total, 0);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: navText(t, "", "label"), href: `/${ws}` },
          { label: navText(t, "contacts", "label"), href: `/${ws}/contacts` },
          { label: c.name ?? c.email },
        ]}
      />
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {(c.name ?? c.email).slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{c.name ?? c.email}</h1>
          <p className="text-sm text-muted-foreground">
            <span dir="ltr">{c.email}</span> · {t("contacts.added", { when: f.timeAgo(c.createdAt) })}
            {data.sourceFunnel && c.sourceFunnelId ? (
              <>
                {" "}
                <Link href={`/${ws}/funnels/${c.sourceFunnelId}`} className="hover:underline">
                  {t("contacts.via", { source: data.sourceFunnel })}
                </Link>
              </>
            ) : (
              ""
            )}
            {c.attribution?.utmSource ? ` (${c.attribution.utmSource})` : ""}
          </p>
        </div>
        <div className="flex gap-6 text-end">
          <div>
            <div className="text-xs text-muted-foreground">{t("contacts.lifetimeValue")}</div>
            <div className="text-xl font-semibold tabular-nums">
              {f.money(spent, data.orders[0]?.currency ?? "usd")}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">{t("contacts.orders")}</div>
            <div className="text-xl font-semibold tabular-nums">{data.orders.length}</div>
          </div>
        </div>
        {c.unsubscribedAt && <Badge variant="warning">{t("contacts.unsubscribedBadge")}</Badge>}
        <EnrollMenu
          workspaceSlug={ws}
          contactId={c.id}
          workflows={workflows.filter((w) => w.w.status === "active").map((w) => ({ id: w.w.id, name: w.w.name }))}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <ContactProfile
          workspaceSlug={ws}
          contact={{ id: c.id, name: c.name, phone: c.phone, tags: c.tags, fields: c.fields ?? {} }}
          fields={data.fields.map((f) => ({ key: f.key, label: f.label, type: f.type, options: f.options }))}
          canDelete={canManage(ctx.membership.role)}
        />
        <section>
          <h2 className="mb-3 font-semibold">{t("contacts.activityTitle")}</h2>
          <NoteForm workspaceSlug={ws} contactId={c.id} />
          <div className="mt-4">
            <Timeline items={timeline.map((i) => ({ ...i, at: i.at.toISOString() }))} />
          </div>
        </section>
      </div>
    </>
  );
}
