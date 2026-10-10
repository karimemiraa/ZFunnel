import { affiliates, and, eq, getDb, sql, withSystem } from "@zfunnel/db";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { currentWorkspace } from "@/lib/site";

/** Counts an affiliate link click. Always 204. */
export async function POST(req: Request) {
  const done = new Response(null, { status: 204 });
  if (!rateLimit(`aff:${clientIp(req.headers)}`, 30, 60_000)) return done;
  const ws = await currentWorkspace();
  const p = z.object({ code: z.string().regex(/^[a-z0-9-]{3,32}$/) }).safeParse(await req.json().catch(() => null));
  if (!ws || !p.success) return done;
  await withSystem(getDb(), (tx) =>
    tx
      .update(affiliates)
      .set({ clicks: sql`${affiliates.clicks} + 1` })
      .where(and(eq(affiliates.workspaceId, ws.id), eq(affiliates.code, p.data.code), eq(affiliates.status, "active"))),
  );
  return done;
}
