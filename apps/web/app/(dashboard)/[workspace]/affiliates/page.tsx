import { affiliates, affiliateSettings, contacts, desc, eq, sql } from "@zfunnel/db";
import { formatMoney } from "@zfunnel/payments/money";
import { AffiliateRowActions, ProgramSettings } from "@/components/affiliates/affiliate-ui";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { requireWorkspace } from "@/lib/context";
import { inWorkspace } from "@/lib/funnels";
import { siteOrigin } from "@/lib/urls";

export const metadata = { title: "Affiliates" };

export default async function AffiliatesPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const ws = ctx.workspace.slug;
  const { settings, rows } = await inWorkspace(ctx, async (tx) => {
    const [settings] = await tx.select().from(affiliateSettings);
    const rows = await tx
      .select({
        a: affiliates,
        email: contacts.email,
        name: contacts.name,
        sales: sql<number>`(select count(*)::int from commissions c where c.affiliate_id = "affiliates"."id" and c.status <> 'void')`,
        owed: sql<number>`(select coalesce(sum(c.amount), 0)::int from commissions c where c.affiliate_id = "affiliates"."id" and c.status = 'pending')`,
        paid: sql<number>`(select coalesce(sum(c.amount), 0)::int from commissions c where c.affiliate_id = "affiliates"."id" and c.status = 'paid')`,
        currency: sql<
          string | null
        >`(select c.currency from commissions c where c.affiliate_id = "affiliates"."id" limit 1)`,
      })
      .from(affiliates)
      .innerJoin(contacts, eq(contacts.id, affiliates.contactId))
      .orderBy(desc(affiliates.createdAt));
    return { settings, rows };
  });
  const cur = rows.find((r) => r.currency)?.currency ?? "usd";
  const totals = rows.reduce(
    (t, r) => ({
      owed: t.owed + r.owed,
      paid: t.paid + r.paid,
      sales: t.sales + r.sales,
      clicks: t.clicks + r.a.clicks,
    }),
    { owed: 0, paid: 0, sales: 0, clicks: 0 },
  );
  return (
    <>
      <PageHeader
        title="Affiliates"
        description="Let partners promote your offers for a commission. Track clicks, referred sales and payouts."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Affiliates" value={rows.length.toLocaleString()} />
        <StatCard label="Clicks" value={totals.clicks.toLocaleString()} />
        <StatCard label="Referred sales" value={totals.sales.toLocaleString()} />
        <StatCard
          label="Owed"
          value={formatMoney(totals.owed, cur)}
          hint={`${formatMoney(totals.paid, cur)} paid so far`}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <ProgramSettings
          workspaceSlug={ws}
          portalUrl={`${siteOrigin(ws)}/affiliate`}
          initial={{
            enabled: settings?.enabled ?? false,
            commissionPercent: settings?.commissionPercent ?? 30,
            cookieDays: settings?.cookieDays ?? 30,
            terms: settings?.terms ?? "",
          }}
        />
        <div className="overflow-hidden rounded-xl border bg-card">
          {rows.length === 0 ? (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No affiliates yet. Open the program and share the sign-up link with your best customers.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Affiliate</th>
                  <th className="px-4 py-3 text-end">Clicks</th>
                  <th className="px-4 py-3 text-end">Sales</th>
                  <th className="px-4 py-3 text-end">Owed</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.a.id} className={r.a.status === "disabled" ? "opacity-50" : undefined}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.name || r.email}</div>
                      <div className="text-xs text-muted-foreground">?aff={r.a.code}</div>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums">{r.a.clicks.toLocaleString()}</td>
                    <td className="px-4 py-3 text-end tabular-nums">{r.sales.toLocaleString()}</td>
                    <td className="px-4 py-3 text-end font-semibold tabular-nums">
                      {formatMoney(r.owed, r.currency ?? cur)}
                    </td>
                    <td className="px-4 py-3">
                      <AffiliateRowActions workspaceSlug={ws} id={r.a.id} owed={r.owed} status={r.a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
