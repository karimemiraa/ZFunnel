import { formatMoney } from "@zfunnel/payments/money";
import { Badge } from "@zfunnel/ui/badge";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { ContactIcon, UsersIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { listContacts } from "@/lib/commerce";
import { requireWorkspace } from "@/lib/context";
import { timeAgo } from "@/lib/format";

export const metadata = { title: "Contacts" };

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await requireWorkspace(params);
  const { q } = await searchParams;
  const rows = await listContacts(ctx, { q });

  return (
    <>
      <PageHeader
        title="Contacts"
        description="Everyone who opted in or bought from your funnels. Tags, segments and pipelines arrive in Phase 2."
        actions={<SearchInput placeholder="Search name or email" />}
      />
      {rows.length === 0 ? (
        <EmptyState
          icon={<UsersIcon />}
          title={q ? "No matching contacts" : "No contacts yet"}
          description="Publish a funnel with an opt-in form or checkout; new leads and customers show up here instantly."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3 max-md:hidden">Source</th>
                <th className="px-4 py-3 max-sm:hidden">Status</th>
                <th className="px-4 py-3 text-right">Spent</th>
                <th className="px-4 py-3 text-right max-md:hidden">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map(({ contact: c, orderCount, spent, funnelName }) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {(c.name ?? c.email).slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{c.name ?? "—"}</div>
                        <div className="truncate text-xs text-muted-foreground">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 max-md:hidden">
                    <div className="truncate">{funnelName ?? "—"}</div>
                    {c.attribution?.utmSource && (
                      <div className="text-xs text-muted-foreground">
                        via {c.attribution.utmSource}
                        {c.attribution.utmCampaign ? ` · ${c.attribution.utmCampaign}` : ""}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 max-sm:hidden">
                    {orderCount > 0 ? (
                      <Badge variant="success">Customer · {orderCount}</Badge>
                    ) : (
                      <Badge variant="secondary">Lead</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {spent ? formatMoney(spent, "usd") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground max-md:hidden">
                    {timeAgo(c.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <ContactIcon className="size-3.5" /> Showing the {rows.length >= 200 ? "200 most recent" : rows.length}{" "}
        contacts.
      </p>
    </>
  );
}
