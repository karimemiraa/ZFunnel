import { csvCell } from "@zfunnel/shared";
import { listOrders } from "@/lib/commerce";
import { filtersFromParams } from "@/lib/list-filters";
import { requireUser } from "@/lib/session";
import { getWorkspaceForUser, recordAudit } from "@/lib/workspaces";

/** CSV export of picked orders (`?ids=`) or of every order matching the list filters. */
export async function GET(req: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, (await params).workspace);
  if (!ctx) return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const ids = q
    .get("ids")
    ?.split(",")
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const rows = (
    await listOrders(ctx, { filters: filtersFromParams("orders", Object.fromEntries(q)), limit: 100_000 })
  ).filter((o) => !ids || ids.includes(o.id));
  const header = [
    "number",
    "created_at",
    "paid_at",
    "status",
    "test",
    "email",
    "name",
    "currency",
    "total_cents",
    "refunded_cents",
    "items",
  ];
  const lines = [header.join(",")];
  for (const o of rows)
    lines.push(
      [
        o.number,
        o.createdAt.toISOString(),
        o.paidAt?.toISOString(),
        o.status,
        o.test,
        o.email,
        o.name,
        o.currency,
        o.total,
        o.refundedAmount,
        o.items.map((i) => `${i.productName} (${i.role})`).join(" | "),
      ]
        .map(csvCell)
        .join(","),
    );
  await recordAudit(ctx, user.id, { action: "orders.exported", entityType: "order", data: { rows: rows.length } });
  return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="orders-${ctx.workspace.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
