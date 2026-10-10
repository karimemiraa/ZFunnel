"use server";

import { eq, getDb, orgBilling, organizationSuspensions, schema, withSystem, workspaces } from "@zfunnel/db";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewAs, logAdminAction, requireAdmin, viewAsSecret } from "./admin";
import { signViewAs, VIEW_AS_COOKIE, VIEW_AS_TTL_MS } from "./platform-admin";

/**
 * Platform admin actions (ADR-024). Each one runs the admin guard first (non-admins get a
 * 404, exactly like the pages), then works in the system context and writes the audit log.
 */

const orgId = z.string().min(1).max(200);

async function orgExists(id: string) {
  const [row] = await withSystem(getDb(), (tx) =>
    tx
      .select({ id: schema.organization.id, name: schema.organization.name })
      .from(schema.organization)
      .where(eq(schema.organization.id, id)),
  );
  return row ?? null;
}

export async function suspendOrganization(formData: FormData) {
  const admin = await requireAdmin();
  const id = orgId.parse(formData.get("organizationId"));
  const reason =
    String(formData.get("reason") ?? "")
      .trim()
      .slice(0, 500) || null;
  const org = await orgExists(id);
  if (!org) return;
  await withSystem(getDb(), (tx) =>
    tx
      .insert(organizationSuspensions)
      .values({ organizationId: id, reason, suspendedByUserId: admin.id })
      .onConflictDoUpdate({ target: organizationSuspensions.organizationId, set: { reason } }),
  );
  await logAdminAction(admin.id, {
    action: "org.suspend",
    targetType: "organization",
    targetId: id,
    metadata: { name: org.name, reason },
  });
  revalidatePath(`/admin/organizations/${id}`);
}

export async function unsuspendOrganization(formData: FormData) {
  const admin = await requireAdmin();
  const id = orgId.parse(formData.get("organizationId"));
  const org = await orgExists(id);
  if (!org) return;
  await withSystem(getDb(), (tx) =>
    tx.delete(organizationSuspensions).where(eq(organizationSuspensions.organizationId, id)),
  );
  await logAdminAction(admin.id, {
    action: "org.unsuspend",
    targetType: "organization",
    targetId: id,
    metadata: { name: org.name },
  });
  revalidatePath(`/admin/organizations/${id}`);
}

const planSchema = z.enum(["trial", "starter", "pro", "scale"]);

/**
 * Sets the organization's plan directly in org_billing. "trial" removes the row (the org
 * falls back to its trial, or expired). A Stripe-billed org keeps its Stripe ids, so a later
 * subscription event from Stripe can change the plan again.
 */
export async function overridePlan(formData: FormData) {
  const admin = await requireAdmin();
  const id = orgId.parse(formData.get("organizationId"));
  const plan = planSchema.parse(formData.get("plan"));
  const org = await orgExists(id);
  if (!org) return;
  const previous = await withSystem(getDb(), async (tx) => {
    const [before] = await tx.select().from(orgBilling).where(eq(orgBilling.organizationId, id));
    if (plan === "trial") {
      await tx.delete(orgBilling).where(eq(orgBilling.organizationId, id));
    } else {
      await tx
        .insert(orgBilling)
        .values({ organizationId: id, plan, status: "active", provider: "test" })
        .onConflictDoUpdate({ target: orgBilling.organizationId, set: { plan, status: "active" } });
    }
    return before ? { plan: before.plan, status: before.status, provider: before.provider } : null;
  });
  await logAdminAction(admin.id, {
    action: "org.plan",
    targetType: "organization",
    targetId: id,
    metadata: { name: org.name, plan, previous },
  });
  revalidatePath(`/admin/organizations/${id}`);
}

/** Starts a read-only "view as" session for one workspace (signed, 30-minute cookie). */
export async function startViewAs(formData: FormData) {
  const admin = await requireAdmin();
  const workspaceId = z.uuid().parse(formData.get("workspaceId"));
  const [ws] = await withSystem(getDb(), (tx) =>
    tx
      .select({
        id: workspaces.id,
        slug: workspaces.slug,
        name: workspaces.name,
        organizationId: workspaces.organizationId,
      })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId)),
  );
  if (!ws) return;
  const expiresAt = Date.now() + VIEW_AS_TTL_MS;
  (await cookies()).set(
    VIEW_AS_COOKIE,
    signViewAs({ adminUserId: admin.id, workspaceId, slug: ws.slug, expiresAt }, viewAsSecret()),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(expiresAt),
    },
  );
  await logAdminAction(admin.id, {
    action: "viewAs.start",
    targetType: "workspace",
    targetId: ws.id,
    metadata: { name: ws.name, slug: ws.slug, organizationId: ws.organizationId },
  });
  redirect(`/${ws.slug}`);
}

/** Ends "view as" and returns to the organization's admin page. */
export async function stopViewAs() {
  const admin = await requireAdmin();
  const claim = await getViewAs(admin.id);
  (await cookies()).delete(VIEW_AS_COOKIE);
  if (!claim) redirect("/admin");
  const [ws] = await withSystem(getDb(), (tx) =>
    tx
      .select({ organizationId: workspaces.organizationId })
      .from(workspaces)
      .where(eq(workspaces.id, claim.workspaceId)),
  );
  await logAdminAction(admin.id, {
    action: "viewAs.stop",
    targetType: "workspace",
    targetId: claim.workspaceId,
    metadata: { slug: claim.slug },
  });
  redirect(ws ? `/admin/organizations/${ws.organizationId}` : "/admin");
}
