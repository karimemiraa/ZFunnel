import { eq, isNull, and, webinarRegistrations } from "@zfunnel/db";
import { system } from "@zfunnel/payments";
import { enqueue } from "@zfunnel/queue";
import { webinarPhase } from "@zfunnel/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost } from "@/lib/api";
import { registrationByToken } from "@/lib/webinar";

const schema = z.object({ token: z.string().max(64), action: z.enum(["attend", "offer"]) });

/** Marks attendance (while the session is on) or an offer click. Idempotent. */
export async function POST(req: Request) {
  const g = await publicPost(req, "webinar-attend", 30);
  if ("error" in g) return g.error;
  const p = schema.safeParse(g.body);
  if (!p.success) return jsonError("Invalid request");
  const row = await registrationByToken(g.ws.id, p.data.token);
  if (!row) return jsonError("Not found", 404);
  const { r, w } = row;
  const { phase } = webinarPhase(r.sessionAt, w.durationMinutes, w.replayHours);
  if (p.data.action === "attend") {
    // Replays count as attended too, but only the first visit triggers automations.
    if (phase !== "live" && phase !== "replay") return NextResponse.json({ ok: true });
    const updated = await system((tx) =>
      tx
        .update(webinarRegistrations)
        .set({ attendedAt: new Date() })
        .where(and(eq(webinarRegistrations.id, r.id), isNull(webinarRegistrations.attendedAt)))
        .returning({ id: webinarRegistrations.id }),
    );
    if (updated.length)
      await enqueue("workflow-events", {
        workspaceId: g.ws.id,
        contactId: r.contactId,
        type: "webinar_attended",
        data: { webinarId: w.id, replay: phase === "replay" ? "1" : undefined },
      });
  } else {
    await system((tx) =>
      tx
        .update(webinarRegistrations)
        .set({ offerClickedAt: new Date() })
        .where(and(eq(webinarRegistrations.id, r.id), isNull(webinarRegistrations.offerClickedAt))),
    );
  }
  return NextResponse.json({ ok: true });
}
