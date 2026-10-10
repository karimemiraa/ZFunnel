"use server";

import { eq, getDb, orgBilling, withOrganization } from "@zfunnel/db";
import {
  createBillingPortal,
  createPlanCheckout,
  createPlatformCustomer,
  ensurePlatformPrice,
  stripeConfigured,
  testModeEnabled,
} from "@zfunnel/payments";
import { PLANS, type PlanId } from "@zfunnel/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getT } from "./i18n";
import { requireUser } from "./session";
import { canManage, getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: false; error: string };
const appUrl = () => (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function ownerCtx(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  const t = await getT();
  if (!ctx) throw new Error(t("billing.errors.workspaceNotFound"));
  return { user, ctx, t, allowed: canManage(ctx.membership.role) };
}

/** Starts Stripe Checkout for a plan (or, in test mode without Stripe, activates it directly). */
export async function choosePlan(workspaceSlug: string, planId: PlanId): Promise<Result> {
  const { user, ctx, t, allowed } = await ownerCtx(workspaceSlug);
  if (!allowed) return { ok: false, error: t("billing.errors.onlyAdminsPlan") };
  const plan = PLANS[planId];
  if (!plan || plan.id === "trial") return { ok: false, error: t("billing.errors.unknownPlan") };
  const orgId = ctx.membership.organizationId;
  const back = `${appUrl()}/${workspaceSlug}/settings/billing`;

  if (!stripeConfigured()) {
    if (!testModeEnabled()) return { ok: false, error: t("billing.errors.notSetUp") };
    await withOrganization(getDb(), orgId, (tx) =>
      tx
        .insert(orgBilling)
        .values({ organizationId: orgId, plan: plan.id as "starter", status: "active", provider: "test" })
        .onConflictDoUpdate({
          target: orgBilling.organizationId,
          set: { plan: plan.id as "starter", status: "active", provider: "test", cancelAtPeriodEnd: false },
        }),
    );
    await recordAudit(ctx, user.id, {
      action: "billing.plan_changed",
      entityType: "organization",
      data: { plan: plan.id, test: true },
    });
    revalidatePath(`/${workspaceSlug}`, "layout");
    redirect(`/${workspaceSlug}/settings/billing?success=1`);
  }

  const [existing] = await withOrganization(getDb(), orgId, (tx) =>
    tx.select().from(orgBilling).where(eq(orgBilling.organizationId, orgId)),
  );
  if (
    existing?.provider === "stripe" &&
    existing.stripeSubscriptionId &&
    (existing.status === "active" || existing.status === "past_due")
  )
    return { ok: false, error: t("billing.errors.useManage") };
  const customerId =
    existing?.stripeCustomerId ??
    (await createPlatformCustomer({ email: user.email, name: ctx.membership.organizationName, organizationId: orgId }));
  if (!existing?.stripeCustomerId)
    await withOrganization(getDb(), orgId, (tx) =>
      tx
        .insert(orgBilling)
        .values({
          organizationId: orgId,
          plan: plan.id as "starter",
          status: "incomplete",
          provider: "stripe",
          stripeCustomerId: customerId,
        })
        .onConflictDoUpdate({ target: orgBilling.organizationId, set: { stripeCustomerId: customerId } }),
    );
  const priceId = await ensurePlatformPrice({
    lookupKey: `zfunnel_${plan.id}_monthly`,
    productName: `ZFunnel ${plan.name}`,
    amount: plan.monthly,
  });
  const url = await createPlanCheckout({
    customerId,
    priceId,
    organizationId: orgId,
    plan: plan.id,
    successUrl: `${back}?success=1`,
    cancelUrl: back,
  });
  redirect(url);
}

export async function openBillingPortal(workspaceSlug: string): Promise<Result> {
  const { ctx, t, allowed } = await ownerCtx(workspaceSlug);
  if (!allowed) return { ok: false, error: t("billing.errors.onlyAdminsBilling") };
  const orgId = ctx.membership.organizationId;
  const [row] = await withOrganization(getDb(), orgId, (tx) =>
    tx.select().from(orgBilling).where(eq(orgBilling.organizationId, orgId)),
  );
  if (!row?.stripeCustomerId || !stripeConfigured()) return { ok: false, error: t("billing.errors.noAccount") };
  redirect(await createBillingPortal(row.stripeCustomerId, `${appUrl()}/${workspaceSlug}/settings/billing`));
}
