import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { resolveStepForWorkspace } from "@/lib/resolve";
import { currentWorkspace } from "@/lib/site";
import { track } from "@/lib/track";

const schema = z.object({
  stepId: z.string().uuid(),
  utmSource: z.string().max(100).optional(),
  utmMedium: z.string().max(100).optional(),
  utmCampaign: z.string().max(100).optional(),
  referrer: z.string().max(300).optional(),
  device: z.enum(["mobile", "tablet", "desktop"]).optional(),
});

/** Page-view beacon. Always answers 204 so it never shows errors to visitors. */
export async function POST(req: Request) {
  const done = new Response(null, { status: 204 });
  if (!rateLimit(`t:${clientIp(req.headers)}`, 120, 60_000)) return done;
  const ws = await currentWorkspace();
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!ws || !parsed.success) return done;
  const { stepId, ...props } = parsed.data;
  const step = await resolveStepForWorkspace(ws.id, stepId);
  if (!step) return done;
  let referrer = props.referrer;
  try {
    // Keep only the referring host, never full URLs (they can contain personal data).
    referrer = referrer ? new URL(referrer).host : undefined;
  } catch {
    referrer = undefined;
  }
  await track(req.headers, {
    workspaceId: ws.id,
    funnelId: step.funnelId,
    stepId,
    type: "view",
    props: { ...props, referrer },
  });
  return done;
}
