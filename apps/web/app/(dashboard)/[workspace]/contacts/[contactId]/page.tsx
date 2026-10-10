import { formatMoney } from "@zfunnel/payments/money";
import { Badge } from "@zfunnel/ui/badge";
import {
  ArrowLeftIcon,
  CreditCardIcon,
  FilterIcon,
  KanbanIcon,
  MailIcon,
  StickyNoteIcon,
  TagIcon,
  ZapIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrderStatus } from "@/components/commerce/order-status";
import { ContactProfile, NoteForm } from "@/components/crm/contact-profile";
import { EnrollMenu } from "@/components/automations/enroll-menu";
import { listWorkflows } from "@/lib/automations";
import { requireWorkspace } from "@/lib/context";
import { getContactDetail } from "@/lib/crm";
import { timeAgo } from "@/lib/format";
import { canManage } from "@/lib/workspaces";

const ICONS = {
  note: StickyNoteIcon,
  tag_added: TagIcon,
  tag_removed: TagIcon,
  optin: FilterIcon,
  purchase: CreditCardIcon,
  upsell: CreditCardIcon,
  deal_moved: KanbanIcon,
  email_sent: MailIcon,
  email_opened: MailIcon,
  email_clicked: MailIcon,
  unsubscribed: MailIcon,
  automation: ZapIcon,
  form: FilterIcon,
} as const;
const LABEL: Record<string, (b: string | null) => string> = {
  note: () => "Note",
  tag_added: (b) => `Tagged “${b}”`,
  tag_removed: (b) => `Removed tag “${b}”`,
  optin: (b) => `Opted in${b ? ` on ${b}` : ""}`,
  purchase: (b) => `Purchased${b ? ` ${b}` : ""}`,
  upsell: (b) => `Accepted upsell${b ? ` ${b}` : ""}`,
  deal_moved: (b) => `Deal moved: ${b}`,
  email_sent: (b) => `Email sent: ${b}`,
  email_opened: (b) => `Opened: ${b}`,
  email_clicked: (b) => `Clicked: ${b}`,
  automation: (b) => `Automation: ${b}`,
  form: (b) => `Submitted ${b}`,
  unsubscribed: (b) => `Unsubscribed${b ? ` via “${b}”` : ""}`,
};

export default async function ContactPage({ params }: { params: Promise<{ workspace: string; contactId: string }> }) {
  const ctx = await requireWorkspace(params);
  const { contactId } = await params;
  const [data, workflows] = await Promise.all([getContactDetail(ctx, contactId), listWorkflows(ctx)]);
  if (!data) notFound();
  const { contact: c } = data;
  const ws = ctx.workspace.slug;
  const spent = data.orders
    .filter((o) => o.status === "paid" || o.status === "partially_refunded")
    .reduce((s, o) => s + o.total, 0);

  return (
    <>
      <Link
        href={`/${ws}/contacts`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" /> Contacts
      </Link>
      <div className="mb-8 flex flex-wrap items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {(c.name ?? c.email).slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{c.name ?? c.email}</h1>
          <p className="text-sm text-muted-foreground">
            {c.email} · added {timeAgo(c.createdAt)}
            {data.sourceFunnel ? ` via ${data.sourceFunnel}` : ""}
            {c.attribution?.utmSource ? ` (${c.attribution.utmSource})` : ""}
          </p>
        </div>
        <div className="flex gap-6 text-right">
          <div>
            <div className="text-xs text-muted-foreground">Lifetime value</div>
            <div className="text-xl font-semibold tabular-nums">
              {formatMoney(spent, data.orders[0]?.currency ?? "usd")}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Orders</div>
            <div className="text-xl font-semibold tabular-nums">{data.orders.length}</div>
          </div>
        </div>
        {c.unsubscribedAt && <Badge variant="warning">Unsubscribed from email</Badge>}
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
        <div className="space-y-6">
          {data.orders.length > 0 && (
            <section className="rounded-xl border bg-card">
              <h2 className="border-b px-5 py-3 font-semibold">Orders</h2>
              <ul className="divide-y">
                {data.orders.map((o) => (
                  <li key={o.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                    <span className="font-medium">#{o.number}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      {o.items.map((i) => i.productName).join(", ")}
                    </span>
                    <OrderStatus status={o.status} test={o.test} />
                    <span className="w-20 text-right font-medium tabular-nums">{formatMoney(o.total, o.currency)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {data.deals.length > 0 && (
            <section className="rounded-xl border bg-card">
              <h2 className="border-b px-5 py-3 font-semibold">Deals</h2>
              <ul className="divide-y">
                {data.deals.map(({ deal, stage, color, pipeline }) => (
                  <li key={deal.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="size-2 rounded-full" style={{ background: color }} />
                    <span className="flex-1 font-medium">{deal.title}</span>
                    <span className="text-muted-foreground">
                      {pipeline} · {stage}
                    </span>
                    <span className="w-20 text-right tabular-nums">{formatMoney(deal.value, deal.currency)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h2 className="mb-3 font-semibold">Activity</h2>
            <NoteForm workspaceSlug={ws} contactId={c.id} />
            <ol className="mt-4 space-y-0">
              {data.activity.map(({ a, actor }) => {
                const Icon = ICONS[a.type] ?? StickyNoteIcon;
                return (
                  <li key={a.id} className="relative flex gap-3 pb-5 pl-1">
                    <span className="absolute top-8 bottom-0 left-[17px] w-px bg-border" aria-hidden />
                    <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1 pt-1">
                      <div className="text-sm">
                        <span className="font-medium">{(LABEL[a.type] ?? (() => a.type))(a.body)}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {timeAgo(a.createdAt)}
                          {actor ? ` by ${actor}` : ""}
                        </span>
                      </div>
                      {a.type === "note" && a.body && (
                        <p className="mt-1.5 rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-wrap">{a.body}</p>
                      )}
                    </div>
                  </li>
                );
              })}
              {data.activity.length === 0 && <li className="text-sm text-muted-foreground">No activity yet.</li>}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}
