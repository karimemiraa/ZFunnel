"use server";

import { domains, eq, getDb, withSystem } from "@zfunnel/db";
import { isUnderDomain, normalizeHostname } from "@zfunnel/shared";
import { revalidatePath } from "next/cache";
import { checkDomainDns } from "./domains";
import { ROOT_DOMAIN } from "./env";
import { inWorkspace } from "./funnels";
import { enforce } from "./billing";
import { requireUser } from "./session";
import { canManage, getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true; message?: string } | { ok: false; error: string };

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  if (!canManage(ctx.membership.role)) throw new Error("Only owners and admins can manage domains.");
  return { user, ctx };
}

export async function addDomain(workspaceSlug: string, input: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const blocked = await enforce(ctx.membership.organizationId, "domains");
  if (blocked) return { ok: false, error: blocked };
  const hostname = normalizeHostname(input);
  if (!hostname) return { ok: false, error: "That doesn't look like a valid domain, e.g. offer.yourbrand.com" };
  if (isUnderDomain(hostname, ROOT_DOMAIN))
    return { ok: false, error: `You already get ${workspaceSlug}.${ROOT_DOMAIN} for free; add your own domain here.` };
  // Domains are a platform-wide namespace: check across tenants, returning only a boolean.
  const [taken] = await withSystem(getDb(), (tx) =>
    tx.select({ id: domains.id }).from(domains).where(eq(domains.hostname, hostname)),
  );
  if (taken) return { ok: false, error: "This domain is already connected to a workspace." };
  const token = `zf-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  await inWorkspace(ctx, (tx) =>
    tx.insert(domains).values({ workspaceId: ctx.workspace.id, hostname, verificationToken: token }),
  );
  await recordAudit(ctx, user.id, { action: "domain.added", entityType: "domain", data: { hostname } });
  revalidatePath(`/${workspaceSlug}/settings/domains`);
  return { ok: true };
}

export async function verifyDomain(workspaceSlug: string, domainId: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const [d] = await inWorkspace(ctx, (tx) => tx.select().from(domains).where(eq(domains.id, domainId)));
  if (!d) return { ok: false, error: "Domain not found." };
  const check = await checkDomainDns(d.hostname, d.verificationToken);
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
    ? { ok: true, message: `${d.hostname} is connected. SSL is issued automatically on the first visit.` }
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
