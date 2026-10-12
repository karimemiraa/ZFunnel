"use server";

import { and, eq, getDb, revenueGoals, withWorkspace } from "@zfunnel/db";
import { CURRENCIES, parseMoney } from "@zfunnel/shared";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getT } from "./i18n";
import { requireUser } from "./session";
import { canManage, getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true } | { ok: false; error: string };

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
/** Upper bound so a typo can't overflow the integer column. */
const MAX_GOAL = 2_000_000_000;

async function context(slug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, slug);
  const t = await getT();
  if (!ctx || !canManage(ctx.membership.role)) return { t, error: t("settings.onlyAdmins") } as const;
  return { t, user, ctx } as const;
}

/** Sets the monthly revenue goal: the default for every month (month "") or one month ("YYYY-MM"). */
export async function saveRevenueGoal(
  slug: string,
  input: { amount: string; currency: string; month: string },
): Promise<Result> {
  const c = await context(slug);
  if ("error" in c) return { ok: false, error: c.error! };
  const { t, user, ctx } = c;
  const currency = input.currency.toLowerCase();
  if (!(CURRENCIES as readonly string[]).includes(currency)) return { ok: false, error: t("today.goal.invalid") };
  if (input.month !== "" && !MONTH.test(input.month)) return { ok: false, error: t("today.goal.invalid") };
  const amount = parseMoney(input.amount, currency);
  if (amount === null || amount <= 0 || amount > MAX_GOAL) return { ok: false, error: t("today.goal.invalid") };
  const scope = { organizationId: ctx.membership.organizationId, workspaceId: ctx.workspace.id };
  await withWorkspace(getDb(), scope, (tx) =>
    tx
      .insert(revenueGoals)
      .values({ workspaceId: ctx.workspace.id, month: input.month, amount, currency })
      .onConflictDoUpdate({
        target: [revenueGoals.workspaceId, revenueGoals.month],
        set: { amount, currency, updatedAt: new Date() },
      }),
  );
  await recordAudit(ctx, user.id, {
    action: "revenue_goal.saved",
    entityType: "workspace",
    entityId: ctx.workspace.id,
    data: { month: input.month || "default", amount, currency },
  });
  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}

/** Hides the onboarding checklist on the home page for this browser. */
export async function hideChecklist(slug: string) {
  (await cookies()).set(`zf_hide_onboarding_${slug}`, "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath(`/${slug}`);
}

export async function deleteRevenueGoal(slug: string, month: string): Promise<Result> {
  const c = await context(slug);
  if ("error" in c) return { ok: false, error: c.error! };
  const { user, ctx } = c;
  const scope = { organizationId: ctx.membership.organizationId, workspaceId: ctx.workspace.id };
  await withWorkspace(getDb(), scope, (tx) =>
    tx.delete(revenueGoals).where(and(eq(revenueGoals.workspaceId, ctx.workspace.id), eq(revenueGoals.month, month))),
  );
  await recordAudit(ctx, user.id, {
    action: "revenue_goal.deleted",
    entityType: "workspace",
    entityId: ctx.workspace.id,
    data: { month: month || "default" },
  });
  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}
