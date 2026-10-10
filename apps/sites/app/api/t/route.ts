import { and, eq, getDb, stepVariants, withSystem } from "@zfunnel/db";
import { z } from "zod";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { resolveStepForWorkspace } from "@/lib/resolve";
import { currentWorkspace } from "@/lib/site";
import { track } from "@/lib/track";

const schema = z.object({
  stepId: z.string().uuid(),
  variantId: z.union([z.literal("a"), z.string().uuid()]).optional(),
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
  const { stepId, variantId, ...props } = parsed.data;
  const step = await resolveStepForWorkspace(ws.id, stepId);
  if (!step) return done;
  let referrer = props.referrer;
  try {
    // Keep only the referring host, never full URLs (they can contain personal data).
    referrer = referrer ? new URL(referrer).host : undefined;
  } catch {
    referrer = undefined;
  }
  // Only accept a variant that really belongs to this step.
  const variant =
    variantId && variantId !== "a"
      ? await withSystem(getDb(), async (tx) => {
          const [v] = await tx
            .select({ id: stepVariants.id })
            .from(stepVariants)
            .where(and(eq(stepVariants.id, variantId), eq(stepVariants.stepId, stepId)));
          return v?.id ?? null;
        })
      : null;
  await track(req.headers, {
    workspaceId: ws.id,
    funnelId: step.funnelId,
    stepId,
    variantId: variant,
    type: "view",
    props: { ...props, referrer },
  });
  return done;
}
