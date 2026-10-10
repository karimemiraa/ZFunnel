import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost } from "@/lib/api";
import { currentCustomer } from "@/lib/customer";
import { setProgress } from "@/lib/courses";

const schema = z.object({ lessonId: z.string().uuid(), done: z.boolean() });

export async function POST(req: Request) {
  const g = await publicPost(req, "course-progress", 60);
  if ("error" in g) return g.error;
  const customer = await currentCustomer(g.ws.id);
  if (!customer) return jsonError("Please sign in again.", 401);
  const p = schema.safeParse(g.body);
  if (!p.success) return jsonError("Invalid request.");
  if (!(await setProgress(g.ws.id, customer.id, p.data.lessonId, p.data.done)))
    return jsonError("Lesson not available.", 403);
  return NextResponse.json({ ok: true });
}
