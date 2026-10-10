"use server";

import { and, eq, funnelSteps, ne, inArray, paymentAccounts, prices, products, stepOffers } from "@zfunnel/db";
import {
  createConnectedAccount,
  createOnboardingLink,
  CURRENCIES,
  formatMoney,
  getAccountStatus,
  minimumAmount,
  parseMoney,
  stripeConfigured,
} from "@zfunnel/payments";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { inWorkspace } from "./funnels";
import { requireUser } from "./session";
import { canManage, getWorkspaceForUser, recordAudit } from "./workspaces";

export type FormState = { error?: string; success?: string; fieldErrors?: Record<string, string[] | undefined> } | null;
type Result = { ok: true } | { ok: false; error: string };

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  return { user, ctx };
}

// ---------- Products ----------

const productSchema = z
  .object({
    name: z.string().trim().min(2, "At least 2 characters").max(120),
    description: z.string().trim().max(500).optional(),
    imageUrl: z.union([z.literal(""), z.string().url("Must be a full URL (https://…)")]).optional(),
    priceLabel: z.string().trim().max(60).optional(),
    type: z.enum(["one_time", "recurring", "payment_plan"]),
    amount: z.string(),
    currency: z.enum(CURRENCIES),
    interval: z.enum(["month", "year"]).optional(),
    trialDays: z.coerce.number().int().min(0).max(365).optional(),
    installments: z.coerce.number().int().min(2).max(36).optional(),
    inStore: z.boolean(),
    stock: z.coerce.number().int().min(0).max(1_000_000).optional(),
    requiresShipping: z.boolean(),
  })
  .transform((v, c) => {
    // Parsed with the chosen currency: JPY has no decimals, KWD has three.
    const amount = parseMoney(v.amount, v.currency);
    if (amount === null || amount < minimumAmount(v.currency)) {
      c.addIssue({
        code: "custom",
        path: ["amount"],
        message: `Enter a price of at least ${formatMoney(minimumAmount(v.currency), v.currency)}`,
      });
      return z.NEVER;
    }
    return { ...v, amount };
  })
  .refine((v) => v.type !== "payment_plan" || v.installments, {
    message: "How many payments?",
    path: ["installments"],
  });

function readProductForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const val = (k: string) => (raw[k] === "" || raw[k] === undefined ? undefined : raw[k]);
  return productSchema.safeParse({
    name: raw.name,
    description: raw.description,
    imageUrl: raw.imageUrl ?? "",
    priceLabel: raw.priceLabel,
    type: raw.type,
    amount: raw.amount ?? "",
    currency: raw.currency,
    interval: raw.type === "one_time" ? undefined : val("interval"),
    trialDays: raw.type === "recurring" ? val("trialDays") : undefined,
    installments: raw.type === "payment_plan" ? val("installments") : undefined,
    inStore: raw.inStore === "on",
    stock: val("stock"),
    requiresShipping: raw.requiresShipping === "on",
  });
}

export async function saveProduct(
  workspaceSlug: string,
  productId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const parsed = readProductForm(formData);
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  const d = parsed.data;
  const priceValues = {
    label: d.priceLabel || null,
    type: d.type,
    amount: d.amount,
    currency: d.currency,
    interval: d.type === "one_time" ? null : (d.interval ?? "month"),
    trialDays: d.type === "recurring" ? d.trialDays || null : null,
    installments: d.type === "payment_plan" ? (d.installments ?? null) : null,
  };
  const id = await inWorkspace(ctx, async (tx) => {
    if (productId) {
      await tx
        .update(products)
        .set({
          name: d.name,
          description: d.description || null,
          imageUrl: d.imageUrl || null,
          inStore: d.inStore,
          stock: d.stock ?? null,
          requiresShipping: d.requiresShipping,
        })
        .where(eq(products.id, productId));
      const [current] = await tx
        .select()
        .from(prices)
        .where(and(eq(prices.productId, productId)))
        .limit(1);
      const changed =
        !current ||
        current.amount !== priceValues.amount ||
        current.currency !== priceValues.currency ||
        current.type !== priceValues.type ||
        current.interval !== priceValues.interval ||
        current.trialDays !== priceValues.trialDays ||
        current.installments !== priceValues.installments;
      if (changed) {
        // Prices are immutable (orders and Stripe reference them): archive and create a new one,
        // then point existing step offers at the new price.
        const [np] = await tx
          .insert(prices)
          .values({ workspaceId: ctx.workspace.id, productId, ...priceValues })
          .returning();
        if (current) {
          await tx.update(prices).set({ archivedAt: new Date() }).where(eq(prices.id, current.id));
          await tx.update(stepOffers).set({ priceId: np!.id }).where(eq(stepOffers.priceId, current.id));
        }
      } else if (current && current.label !== priceValues.label) {
        await tx.update(prices).set({ label: priceValues.label }).where(eq(prices.id, current.id));
      }
      return productId;
    }
    const [p] = await tx
      .insert(products)
      .values({
        workspaceId: ctx.workspace.id,
        name: d.name,
        description: d.description || null,
        imageUrl: d.imageUrl || null,
        inStore: d.inStore,
        stock: d.stock ?? null,
        requiresShipping: d.requiresShipping,
      })
      .returning();
    await tx.insert(prices).values({ workspaceId: ctx.workspace.id, productId: p!.id, ...priceValues });
    return p!.id;
  });
  await recordAudit(ctx, user.id, {
    action: productId ? "product.updated" : "product.created",
    entityType: "product",
    entityId: id,
    data: { name: d.name },
  });
  revalidatePath(`/${workspaceSlug}/products`);
  return { success: productId ? "Product saved" : "Product created" };
}

export async function archiveProduct(workspaceSlug: string, productId: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, async (tx) => {
    await tx.update(products).set({ archivedAt: new Date() }).where(eq(products.id, productId));
    const ps = await tx.select({ id: prices.id }).from(prices).where(eq(prices.productId, productId));
    if (ps.length)
      await tx.delete(stepOffers).where(
        inArray(
          stepOffers.priceId,
          ps.map((p) => p.id),
        ),
      );
  });
  await recordAudit(ctx, user.id, { action: "product.archived", entityType: "product", entityId: productId });
  revalidatePath(`/${workspaceSlug}/products`);
  return { ok: true };
}

// ---------- Step offers ----------

export async function addStepOffer(
  workspaceSlug: string,
  stepId: string,
  input: { priceId: string; role: "main" | "bump" | "upsell" | "downsell"; headline?: string; description?: string },
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const error = await inWorkspace(ctx, async (tx) => {
    // Both rows are RLS-scoped, but foreign keys bypass RLS, so check explicitly.
    const [price] = await tx
      .select({ id: prices.id, currency: prices.currency })
      .from(prices)
      .where(eq(prices.id, input.priceId));
    const [step] = await tx
      .select({ id: funnelSteps.id, funnelId: funnelSteps.funnelId })
      .from(funnelSteps)
      .where(eq(funnelSteps.id, stepId));
    if (!price || !step) return "Product or step not found.";
    // Bumps and upsells join the same order, so a funnel sells in one currency.
    const [other] = await tx
      .select({ currency: prices.currency })
      .from(stepOffers)
      .innerJoin(prices, eq(prices.id, stepOffers.priceId))
      .innerJoin(funnelSteps, eq(funnelSteps.id, stepOffers.stepId))
      .where(and(eq(funnelSteps.funnelId, step.funnelId), ne(prices.currency, price.currency)))
      .limit(1);
    if (other)
      return `This funnel already sells in ${other.currency.toUpperCase()}. All products in one funnel must use the same currency.`;
    const existing = await tx.select().from(stepOffers).where(eq(stepOffers.stepId, stepId));
    await tx.insert(stepOffers).values({
      workspaceId: ctx.workspace.id,
      stepId,
      priceId: input.priceId,
      role: input.role,
      position: existing.length,
      headline: input.headline?.slice(0, 160) || null,
      description: input.description?.slice(0, 400) || null,
    });
    return null;
  });
  if (error) return { ok: false, error };
  revalidatePath(`/${workspaceSlug}/funnels`, "layout");
  return { ok: true };
}

export async function updateStepOffer(
  workspaceSlug: string,
  offerId: string,
  input: { headline?: string; description?: string },
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) =>
    tx
      .update(stepOffers)
      .set({ headline: input.headline?.slice(0, 160) || null, description: input.description?.slice(0, 400) || null })
      .where(eq(stepOffers.id, offerId)),
  );
  revalidatePath(`/${workspaceSlug}/funnels`, "layout");
  return { ok: true };
}

export async function removeStepOffer(workspaceSlug: string, offerId: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.delete(stepOffers).where(eq(stepOffers.id, offerId)));
  revalidatePath(`/${workspaceSlug}/funnels`, "layout");
  return { ok: true };
}

// ---------- Stripe Connect ----------

async function appOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return process.env.BETTER_AUTH_URL ?? `${proto}://${host}`;
}

export async function connectStripe(workspaceSlug: string) {
  const { user, ctx } = await ctxFor(workspaceSlug);
  if (!canManage(ctx.membership.role)) throw new Error("Only owners and admins can connect payments.");
  if (!stripeConfigured()) throw new Error("Stripe isn't configured on this server yet (STRIPE_SECRET_KEY).");
  let accountId = (
    await inWorkspace(ctx, (tx) => tx.select().from(paymentAccounts).where(eq(paymentAccounts.provider, "stripe")))
  )[0]?.externalId;
  if (!accountId) {
    const acct = await createConnectedAccount({ email: user.email, workspaceId: ctx.workspace.id });
    accountId = acct.id;
    await inWorkspace(ctx, (tx) =>
      tx.insert(paymentAccounts).values({
        workspaceId: ctx.workspace.id,
        provider: "stripe",
        externalId: acct.id,
        livemode: Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")),
      }),
    );
    await recordAudit(ctx, user.id, {
      action: "payments.connect_started",
      entityType: "payment_account",
      entityId: acct.id,
    });
  }
  const origin = await appOrigin();
  const base = `${origin}/${workspaceSlug}/settings/payments`;
  redirect(await createOnboardingLink(accountId, { refreshUrl: `${base}?refresh=1`, returnUrl: `${base}?return=1` }));
}

export async function refreshStripeStatus(workspaceSlug: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const [acct] = await inWorkspace(ctx, (tx) =>
    tx.select().from(paymentAccounts).where(eq(paymentAccounts.provider, "stripe")),
  );
  if (!acct || !stripeConfigured()) return { ok: false, error: "No Stripe account connected." };
  const s = await getAccountStatus(acct.externalId);
  await inWorkspace(ctx, (tx) => tx.update(paymentAccounts).set(s).where(eq(paymentAccounts.id, acct.id)));
  revalidatePath(`/${workspaceSlug}/settings/payments`);
  return { ok: true };
}

export async function disconnectStripe(workspaceSlug: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  if (!canManage(ctx.membership.role)) return { ok: false, error: "Only owners and admins can disconnect payments." };
  await inWorkspace(ctx, (tx) => tx.delete(paymentAccounts).where(eq(paymentAccounts.provider, "stripe")));
  await recordAudit(ctx, user.id, { action: "payments.disconnected", entityType: "payment_account" });
  revalidatePath(`/${workspaceSlug}/settings/payments`);
  return { ok: true };
}
