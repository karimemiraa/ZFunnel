import { csvCell } from "@zfunnel/shared";
import { getFormResponses, summarize } from "@/lib/forms";
import { requireUser } from "@/lib/session";
import { getWorkspaceForUser, recordAudit } from "@/lib/workspaces";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ workspace: string; stepId: string; blockId: string }> },
) {
  const user = await requireUser();
  const { workspace, stepId, blockId } = await params;
  const ctx = await getWorkspaceForUser(user.id, workspace);
  if (!ctx) return new Response("Not found", { status: 404 });
  const rows = await getFormResponses(ctx, stepId, decodeURIComponent(blockId), 100_000);
  const qs = summarize(rows);
  const lines = [
    ["submitted_at", "email", "name", ...qs.map((q) => q.label), "score", "result"].map(csvCell).join(","),
  ];
  for (const { s, email, name } of rows) {
    const vals = qs.map((q) => {
      const a = s.answers.find((x) => x.key === q.key);
      return a ? (Array.isArray(a.value) ? a.value.join("; ") : a.value) : "";
    });
    lines.push(
      [s.createdAt.toISOString(), email ?? "", name ?? "", ...vals, s.score ?? "", s.outcome ?? ""]
        .map(csvCell)
        .join(","),
    );
  }
  await recordAudit(ctx, user.id, { action: "form.exported", entityType: "form", data: { stepId, rows: rows.length } });
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="form-responses-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
