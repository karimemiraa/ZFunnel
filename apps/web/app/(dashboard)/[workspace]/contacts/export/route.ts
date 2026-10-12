import { csvCell } from "@zfunnel/shared";
import { listContactsFiltered, listFields } from "@/lib/crm";
import { filtersFromParams } from "@/lib/list-filters";
import { requireUser } from "@/lib/session";
import { getWorkspaceForUser, recordAudit } from "@/lib/workspaces";

/** CSV export of the current contact view (same filters as the page). */
export async function GET(req: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, (await params).workspace);
  if (!ctx) return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const ids = q
    .get("ids")
    ?.split(",")
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const [{ rows }, fields] = await Promise.all([
    listContactsFiltered(ctx, {
      filters: filtersFromParams("contacts", Object.fromEntries(q)),
      segmentId: q.get("segment") ?? undefined,
      ids,
      limit: 100_000,
    }),
    listFields(ctx),
  ]);
  const header = [
    "email",
    "name",
    "phone",
    "tags",
    "orders",
    "spent_cents",
    "source_funnel",
    "utm_source",
    "utm_campaign",
    "created_at",
    ...fields.map((f) => f.key),
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    const c = r.contact;
    lines.push(
      [
        c.email,
        c.name,
        c.phone,
        c.tags.join("|"),
        r.orderCount,
        r.spent,
        r.funnelName,
        c.attribution?.utmSource,
        c.attribution?.utmCampaign,
        c.createdAt.toISOString(),
        ...fields.map((f) => c.fields?.[f.key]),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  await recordAudit(ctx, user.id, { action: "contacts.exported", entityType: "contact", data: { rows: rows.length } });
  return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="contacts-${ctx.workspace.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
