"use server";

import { domains, eq, getDb, withSystem } from "@zfunnel/db";
import { isUnderDomain, normalizeHostname } from "@zfunnel/shared";
import { revalidatePath } from "next/cache";
import { checkDomainDns } from "./domains";
import { ROOT_DOMAIN } from "./env";
import { inWorkspace } from "./funnels";
import { enforce } from "./billing";
import { getT } from "./i18n";
import { requireUser } from "./session";
import { canManage, getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  const t = await getT();
  if (!ctx) throw new Error(t("domains.workspaceNotFound"));
  if (!canManage(ctx.membership.role)) throw new Error(t("domains.onlyAdmins"));
  return { user, ctx, t };
}

export async function addDomain(workspaceSlug: string, input: string): Promise<Result> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  const blocked = await enforce(ctx.membership.organizationId, "domains");
  if (blocked) return { ok: false, error: blocked };
  const hostname = normalizeHostname(input);
  if (!hostname) return { ok: false, error: t("domains.invalid") };
  if (isUnderDomain(hostname, ROOT_DOMAIN))
    return { ok: false, error: t("domains.alreadyFree", { free: `${workspaceSlug}.${ROOT_DOMAIN}` }) };
  // Domains are a platform-wide namespace: check across tenants, returning only a boolean.
  const [taken] = await withSystem(getDb(), (tx) =>
    tx.select({ id: domains.id }).from(domains).where(eq(domains.hostname, hostname)),
  );
  if (taken) return { ok: false, error: t("domains.taken") };
  const token = `zf-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  await inWorkspace(ctx, (tx) =>
    tx.insert(domains).values({ workspaceId: ctx.workspace.id, hostname, verificationToken: token }),
  );
  await recordAudit(ctx, user.id, { action: "domain.added", entityType: "domain", data: { hostname } });
  revalidatePath(`/${workspaceSlug}/settings/domains`);
  return { ok: true };
}

export async function verifyDomain(workspaceSlug: string, domainId: string): Promise<Result> {
  const { user, ctx, t } = await ctxFor(workspaceSlug);
  const [d] = await inWorkspace(ctx, (tx) => tx.select().from(domains).where(eq(domains.id, domainId)));
  if (!d) return { ok: false, error: t("domains.notFound") };
  const check = await checkDomainDns(d.hostname, d.verificationToken, undefined, t);
  const active = check.ownership && check.routing;
  await inWorkspace(ctx, (tx) =>
    tx
      .update(domains)
      .set({
        status: active ? "active" : d.status === "active" ? "active" : "pending",
        verifiedAt: active ? (d.verifiedAt ?? new Date()) : d.verifiedAt,
        lastCheckedAt: new Date(),
        lastError: active ? null : check.problems.join(" "),
      })
      .where(eq(domains.id, domainId)),
  );
  if (active && d.status !== "active")
    await recordAudit(ctx, user.id, {
      action: "domain.verified",
      entityType: "domain",
      data: { hostname: d.hostname },
    });
  revalidatePath(`/${workspaceSlug}/settings/domains`);
  return active
    ? { ok: true, message: t("domains.connectedMessage", { hostname: d.hostname }) }
    : { ok: false, error: check.problems.join(" ") };
}

export async function setDomainFunnel(
  workspaceSlug: string,
  domainId: string,
  funnelId: string | null,
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.update(domains).set({ funnelId }).where(eq(domains.id, domainId)));
  revalidatePath(`/${workspaceSlug}/settings/domains`);
  return { ok: true };
}

export async function removeDomain(workspaceSlug: string, domainId: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const [d] = await inWorkspace(ctx, (tx) => tx.delete(domains).where(eq(domains.id, domainId)).returning());
  if (d)
    await recordAudit(ctx, user.id, { action: "domain.removed", entityType: "domain", data: { hostname: d.hostname } });
  revalidatePath(`/${workspaceSlug}/settings/domains`);
  return { ok: true };
}
