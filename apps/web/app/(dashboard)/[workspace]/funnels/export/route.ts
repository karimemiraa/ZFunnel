import { csvCell } from "@zfunnel/shared";
import { listFunnels } from "@/lib/funnels";
import { requireUser } from "@/lib/session";
import { siteOrigin } from "@/lib/urls";
import { getWorkspaceForUser, recordAudit } from "@/lib/workspaces";

/** CSV of the picked funnels (`?ids=`), or all of them. */
export async function GET(req: Request, { params }: { params: Promise<{ workspace: string }> }) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, (await params).workspace);
  if (!ctx) return new Response("Not found", { status: 404 });
  const ids = new URL(req.url).searchParams
    .get("ids")
    ?.split(",")
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  const rows = (await listFunnels(ctx)).filter((f) => !ids || ids.includes(f.id));
  const lines = [["name", "slug", "url", "steps", "published_steps", "updated_at"].join(",")];
  for (const f of rows)
    lines.push(
      [
        f.name,
        f.slug,
        `${siteOrigin(ctx.workspace.slug)}/${f.slug}`,
        f.stepCount,
        f.publishedCount,
        f.updatedAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    );
  await recordAudit(ctx, user.id, { action: "funnels.exported", entityType: "funnel", data: { rows: rows.length } });
  return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="funnels-${ctx.workspace.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
