"use server";

import { affiliates, affiliateSettings, and, commissions, eq } from "@zfunnel/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inWorkspace } from "./funnels";
import { requireUser } from "./session";
import { canManage, getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function managerCtx(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  if (!canManage(ctx.membership.role)) throw new Error("Only owners and admins can manage affiliates.");
  return { user, ctx };
}

const schema = z.object({
  enabled: z.boolean(),
  commissionPercent: z.number().int().min(1).max(90),
  cookieDays: z.number().int().min(1).max(365),
  terms: z.string().trim().max(3000),
});

export async function saveAffiliateSettings(workspaceSlug: string, input: z.input<typeof schema>): Promise<Result> {
  const { user, ctx } = await managerCtx(workspaceSlug);
  const d = schema.safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  await inWorkspace(ctx, (tx) =>
    tx
      .insert(affiliateSettings)
      .values({ workspaceId: ctx.workspace.id, ...d.data })
      .onConflictDoUpdate({ target: affiliateSettings.workspaceId, set: d.data }),
  );
  await recordAudit(ctx, user.id, {
    action: "affiliates.settings_updated",
    entityType: "affiliate_settings",
    data: d.data,
  });
  revalidatePath(`/${workspaceSlug}/affiliates`);
  return { ok: true, message: d.data.enabled ? "Affiliate program is live" : "Saved" };
}

export async function setAffiliateStatus(
  workspaceSlug: string,
  affiliateId: string,
  status: "active" | "disabled",
): Promise<Result> {
  const { ctx } = await managerCtx(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.update(affiliates).set({ status }).where(eq(affiliates.id, affiliateId)));
  revalidatePath(`/${workspaceSlug}/affiliates`);
  return { ok: true };
}

/** Marks all pending commissions of an affiliate as paid (after you paid them outside ZFunnel). */
export async function markAffiliatePaid(workspaceSlug: string, affiliateId: string): Promise<Result> {
  const { user, ctx } = await managerCtx(workspaceSlug);
  const rows = await inWorkspace(ctx, (tx) =>
    tx
      .update(commissions)
      .set({ status: "paid", paidAt: new Date() })
      .where(and(eq(commissions.affiliateId, affiliateId), eq(commissions.status, "pending")))
      .returning({ amount: commissions.amount }),
  );
  await recordAudit(ctx, user.id, {
    action: "affiliates.paid",
    entityType: "affiliate",
    entityId: affiliateId,
    data: { commissions: rows.length, amount: rows.reduce((s, r) => s + r.amount, 0) },
  });
  revalidatePath(`/${workspaceSlug}/affiliates`);
  return { ok: true, message: `Marked ${rows.length} commissions as paid` };
}
