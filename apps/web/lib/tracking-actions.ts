"use server";

import { trackingSettings } from "@zfunnel/db";
import { sealSecret } from "@zfunnel/email";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inWorkspace } from "./funnels";
import { requireUser } from "./session";
import { canManage, getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true; message?: string } | { ok: false; error: string };
export type Platform = "meta" | "tiktok" | "ga4";

const ID_RULES: Record<Platform, { re: RegExp; message: string }> = {
  meta: { re: /^\d{10,20}$/, message: "The Meta pixel (dataset) ID is a 15–16 digit number." },
  tiktok: { re: /^[A-Z0-9]{15,25}$/i, message: "The TikTok pixel code looks like CABCDEFG1234567890." },
  ga4: { re: /^G-[A-Z0-9]{4,15}$/i, message: "The GA4 measurement ID looks like G-ABC123XYZ." },
};
const LABEL: Record<Platform, string> = { meta: "Meta", tiktok: "TikTok", ga4: "Google Analytics 4" };

const schema = z.object({
  id: z.string().trim().max(40),
  token: z.string().trim().max(600),
  testCode: z.string().trim().max(40),
});

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx || !canManage(ctx.membership.role)) return null;
  return { user, ctx };
}

/** Saves one platform. Leave the token empty to keep the stored one. */
export async function saveTrackingPlatform(
  workspaceSlug: string,
  platform: Platform,
  input: z.input<typeof schema>,
): Promise<Result> {
  const c = await ctxFor(workspaceSlug);
  if (!c) return { ok: false, error: "Only owners and admins can change tracking." };
  const d = schema.safeParse(input);
  if (!d.success) return { ok: false, error: "Check the fields and try again." };
  const rule = ID_RULES[platform];
  if (!rule.re.test(d.data.id)) return { ok: false, error: rule.message };
  const err = await inWorkspace(c.ctx, async (tx) => {
    const [cur] = await tx.select().from(trackingSettings);
    const stored =
      platform === "meta"
        ? cur?.metaTokenSealed
        : platform === "tiktok"
          ? cur?.tiktokTokenSealed
          : cur?.ga4SecretSealed;
    if (!stored && !d.data.token)
      return platform === "ga4" ? "Enter the Measurement Protocol API secret." : "Enter the access token.";
    const sealed = d.data.token ? sealSecret(d.data.token) : stored!;
    const set =
      platform === "meta"
        ? { metaPixelId: d.data.id, metaTokenSealed: sealed, metaTestCode: d.data.testCode || null }
        : platform === "tiktok"
          ? {
              tiktokPixelCode: d.data.id.toUpperCase(),
              tiktokTokenSealed: sealed,
              tiktokTestCode: d.data.testCode || null,
            }
          : { ga4MeasurementId: d.data.id.toUpperCase(), ga4SecretSealed: sealed };
    await tx
      .insert(trackingSettings)
      .values({ workspaceId: c.ctx.workspace.id, ...set })
      .onConflictDoUpdate({ target: trackingSettings.workspaceId, set });
    return null;
  });
  if (err) return { ok: false, error: err };
  await recordAudit(c.ctx, c.user.id, { action: "tracking.connected", entityType: "tracking", data: { platform } });
  revalidatePath(`/${workspaceSlug}/settings/tracking`);
  return { ok: true, message: `${LABEL[platform]} connected` };
}

export async function disconnectTrackingPlatform(workspaceSlug: string, platform: Platform): Promise<Result> {
  const c = await ctxFor(workspaceSlug);
  if (!c) return { ok: false, error: "Only owners and admins can change tracking." };
  const set =
    platform === "meta"
      ? { metaPixelId: null, metaTokenSealed: null, metaTestCode: null }
      : platform === "tiktok"
        ? { tiktokPixelCode: null, tiktokTokenSealed: null, tiktokTestCode: null }
        : { ga4MeasurementId: null, ga4SecretSealed: null };
  await inWorkspace(c.ctx, (tx) => tx.update(trackingSettings).set(set));
  await recordAudit(c.ctx, c.user.id, { action: "tracking.disconnected", entityType: "tracking", data: { platform } });
  revalidatePath(`/${workspaceSlug}/settings/tracking`);
  return { ok: true, message: `${LABEL[platform]} disconnected` };
}
