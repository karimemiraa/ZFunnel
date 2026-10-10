"use server";

import { auth } from "@zfunnel/auth";
import { eq, getDb, withOrganization, workspaces } from "@zfunnel/db";
import { createOrganizationSchema, createWorkspaceSchema, slugify } from "@zfunnel/shared";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@zfunnel/i18n";
import { enforce } from "./billing";
import { getT, localizeMessage } from "./i18n";
import { requireUser } from "./session";
import {
  canManage,
  getMemberships,
  getWorkspaceForUser,
  isSlugAvailable,
  isUniqueViolation,
  recordAudit,
  type Membership,
} from "./workspaces";

export type ActionState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string[] | undefined>;
} | null;

/** Zod field errors with i18n-key messages translated for the current user. */
async function fieldErrors(error: z.ZodError) {
  const t = await getT();
  const errors = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  return Object.fromEntries(
    Object.entries(errors).map(([k, v]) => [k, v?.map((m) => localizeMessage(t, m) ?? m)]),
  ) as Record<string, string[] | undefined>;
}

async function insertWorkspace(membership: Membership, actorUserId: string, input: { name: string; slug: string }) {
  const { organizationId } = membership;
  const workspace = await withOrganization(getDb(), organizationId, async (tx) => {
    const [row] = await tx
      .insert(workspaces)
      .values({ organizationId, ...input })
      .returning();
    return row!;
  });
  await recordAudit({ workspace, membership }, actorUserId, {
    action: "workspace.created",
    entityType: "workspace",
    entityId: workspace.id,
    data: { name: workspace.name, slug: workspace.slug },
  });
  return workspace;
}

/** Onboarding: creates the user's organization and its first workspace. */
export async function createFirstWorkspace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const t = await getT();
  const SLUG_TAKEN = t("workspace.slugTaken");
  const parsed = createWorkspaceSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });
  if (!parsed.success) return { fieldErrors: await fieldErrors(parsed.error) };

  const orgName = String(formData.get("organization") || parsed.data.name).trim();
  const org = createOrganizationSchema.safeParse({
    name: orgName,
    // Org slugs are internal; a random suffix avoids collisions between businesses with the same name.
    slug: `${slugify(orgName).slice(0, 40) || "org"}-${crypto.randomUUID().slice(0, 6)}`,
  });
  if (!org.success) return { fieldErrors: { organization: (await fieldErrors(org.error)).name } };

  if (!(await isSlugAvailable(parsed.data.slug))) return { fieldErrors: { slug: [SLUG_TAKEN] } };

  const created = await auth.api.createOrganization({ body: org.data, headers: await headers() });
  if (!created) return { error: t("workspace.orgCreateFailed") };

  try {
    await insertWorkspace(
      { organizationId: created.id, organizationName: created.name, role: "owner" },
      user.id,
      parsed.data,
    );
  } catch (error) {
    // Lost a race for the subdomain: roll back the empty organization.
    await auth.api
      .deleteOrganization({ body: { organizationId: created.id }, headers: await headers() })
      .catch(() => {});
    if (isUniqueViolation(error)) return { fieldErrors: { slug: [SLUG_TAKEN] } };
    throw error;
  }
  redirect(`/${parsed.data.slug}`);
}

/** Adds another workspace to an organization the user manages. */
export async function createWorkspace(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const t = await getT();
  const SLUG_TAKEN = t("workspace.slugTaken");
  const parsed = createWorkspaceSchema.safeParse({ name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) return { fieldErrors: await fieldErrors(parsed.error) };

  const organizationId = String(formData.get("organizationId") ?? "");
  const membership = (await getMemberships(user.id)).find((m) => m.organizationId === organizationId);
  if (!membership || !canManage(membership.role)) return { error: t("workspace.noPermission") };
  const blocked = await enforce(organizationId, "workspaces");
  if (blocked) return { error: blocked };
  if (!(await isSlugAvailable(parsed.data.slug))) return { fieldErrors: { slug: [SLUG_TAKEN] } };

  try {
    await insertWorkspace(membership, user.id, parsed.data);
  } catch (error) {
    if (isUniqueViolation(error)) return { fieldErrors: { slug: [SLUG_TAKEN] } };
    throw error;
  }
  redirect(`/${parsed.data.slug}`);
}

const renameSchema = z.object({ name: createWorkspaceSchema.shape.name });

export async function renameWorkspace(slug: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, slug);
  const t = await getT();
  if (!ctx) return { error: t("workspace.notFound") };
  if (!canManage(ctx.membership.role)) return { error: t("workspace.onlyAdminsRename") };

  const parsed = renameSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) return { fieldErrors: await fieldErrors(parsed.error) };

  await withOrganization(getDb(), ctx.membership.organizationId, (tx) =>
    tx.update(workspaces).set({ name: parsed.data.name }).where(eq(workspaces.id, ctx.workspace.id)),
  );
  await recordAudit(ctx, user.id, {
    action: "workspace.renamed",
    entityType: "workspace",
    entityId: ctx.workspace.id,
    data: { from: ctx.workspace.name, to: parsed.data.name },
  });
  revalidatePath(`/${slug}`, "layout");
  return { success: t("settings.renamed") };
}

const brandingSchema = z.object({
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "workspace.branding.httpsLogo"),
  brandColor: z.string().regex(/^#[0-9a-f]{6}$/i, "workspace.branding.pickColor"),
  hideBadge: z.boolean(),
});

/** White-label settings: logo, brand color and the "Powered by" badge (paid feature). */
export async function saveBranding(
  slug: string,
  input: z.input<typeof brandingSchema>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, slug);
  const t = await getT();
  if (!ctx) return { ok: false, error: t("workspace.notFound") };
  if (!canManage(ctx.membership.role)) return { ok: false, error: t("workspace.branding.onlyAdmins") };
  const d = brandingSchema.safeParse(input);
  if (!d.success) return { ok: false, error: localizeMessage(t, d.error.issues[0]!.message)! };
  if (d.data.hideBadge) {
    const blocked = await enforce(ctx.membership.organizationId, "whiteLabel");
    if (blocked) return { ok: false, error: blocked };
  }
  await withOrganization(getDb(), ctx.membership.organizationId, (tx) =>
    tx
      .update(workspaces)
      .set({ logoUrl: d.data.logoUrl || null, brandColor: d.data.brandColor, hideBadge: d.data.hideBadge })
      .where(eq(workspaces.id, ctx.workspace.id)),
  );
  await recordAudit(ctx, user.id, {
    action: "workspace.branding_updated",
    entityType: "workspace",
    entityId: ctx.workspace.id,
    data: { hideBadge: d.data.hideBadge },
  });
  revalidatePath(`/${slug}/settings`);
  return { ok: true };
}

/** Language of the workspace's public pages, checkout and customer emails. */
export async function saveSiteLanguage(
  slug: string,
  locale: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, slug);
  const t = await getT();
  if (!ctx || !canManage(ctx.membership.role)) return { ok: false, error: t("settings.onlyAdmins") };
  if (!isLocale(locale)) return { ok: false, error: t("common.somethingWrong") };
  await withOrganization(getDb(), ctx.membership.organizationId, (tx) =>
    tx.update(workspaces).set({ siteLocale: locale }).where(eq(workspaces.id, ctx.workspace.id)),
  );
  await recordAudit(ctx, user.id, {
    action: "workspace.site_language",
    entityType: "workspace",
    entityId: ctx.workspace.id,
    data: { locale },
  });
  revalidatePath(`/${slug}`, "layout");
  return { ok: true };
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/sign-in");
}
