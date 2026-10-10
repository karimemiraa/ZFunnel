"use server";

import { randomBytes } from "node:crypto";
import { and, apiKeys, eq, webhookDeliveries, webhookEndpoints, WEBHOOK_EVENTS } from "@zfunnel/db";
import { enqueue } from "@zfunnel/queue";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashKey, newApiKey } from "./api-auth";
import { inWorkspace } from "./funnels";
import { requireUser } from "./session";
import { canManage, getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true; message?: string; secret?: string } | { ok: false; error: string };

async function managerCtx(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  if (!canManage(ctx.membership.role)) throw new Error("Only owners and admins can manage API keys and webhooks.");
  return { user, ctx };
}
const refresh = (ws: string) => revalidatePath(`/${ws}/settings/developers`);

export async function createApiKey(workspaceSlug: string, name: string): Promise<Result> {
  const { user, ctx } = await managerCtx(workspaceSlug);
  const n = z.string().trim().min(1, "Name the key, e.g. “Zapier”").max(60).safeParse(name);
  if (!n.success) return { ok: false, error: n.error.issues[0]!.message };
  const key = newApiKey();
  await inWorkspace(ctx, (tx) =>
    tx
      .insert(apiKeys)
      .values({ workspaceId: ctx.workspace.id, name: n.data, prefix: key.slice(0, 10), hash: hashKey(key) }),
  );
  await recordAudit(ctx, user.id, { action: "api_key.created", entityType: "api_key", data: { name: n.data } });
  refresh(workspaceSlug);
  return { ok: true, secret: key };
}

export async function revokeApiKey(workspaceSlug: string, id: string): Promise<Result> {
  const { user, ctx } = await managerCtx(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id)));
  await recordAudit(ctx, user.id, { action: "api_key.revoked", entityType: "api_key", entityId: id });
  refresh(workspaceSlug);
  return { ok: true, message: "Key revoked" };
}

const endpointSchema = z.object({
  url: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .refine((u) => /^https:\/\//.test(u), "Webhook URLs must use https://")
    .max(500),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Pick at least one event"),
});

export async function createWebhook(workspaceSlug: string, input: z.input<typeof endpointSchema>): Promise<Result> {
  const { user, ctx } = await managerCtx(workspaceSlug);
  const d = endpointSchema.safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const secret = `whsec_${randomBytes(24).toString("base64url")}`;
  await inWorkspace(ctx, (tx) =>
    tx
      .insert(webhookEndpoints)
      .values({ workspaceId: ctx.workspace.id, url: d.data.url, events: d.data.events, secret }),
  );
  await recordAudit(ctx, user.id, { action: "webhook.created", entityType: "webhook", data: { url: d.data.url } });
  refresh(workspaceSlug);
  return { ok: true, message: "Webhook added", secret };
}

export async function setWebhookStatus(
  workspaceSlug: string,
  id: string,
  status: "active" | "disabled",
): Promise<Result> {
  const { ctx } = await managerCtx(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.update(webhookEndpoints).set({ status }).where(eq(webhookEndpoints.id, id)));
  refresh(workspaceSlug);
  return { ok: true };
}

export async function deleteWebhook(workspaceSlug: string, id: string): Promise<Result> {
  const { ctx } = await managerCtx(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.delete(webhookEndpoints).where(eq(webhookEndpoints.id, id)));
  refresh(workspaceSlug);
  return { ok: true, message: "Webhook removed" };
}

/** Sends a sample event so the receiver can be tested before real traffic. */
export async function sendTestWebhook(workspaceSlug: string, id: string): Promise<Result> {
  const { ctx } = await managerCtx(workspaceSlug);
  const deliveryId = await inWorkspace(ctx, async (tx) => {
    const [e] = await tx
      .select()
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, id)));
    if (!e) return null;
    const eventId = `test_${Date.now()}`;
    const [d] = await tx
      .insert(webhookDeliveries)
      .values({
        workspaceId: ctx.workspace.id,
        endpointId: id,
        event: "test",
        eventId,
        payload: {
          id: `evt_${eventId}`,
          type: "test",
          createdAt: new Date().toISOString(),
          data: { message: "Hello from ZFunnel 👋" },
        },
      })
      .returning({ id: webhookDeliveries.id });
    return d!.id;
  });
  if (!deliveryId) return { ok: false, error: "Webhook not found" };
  const ok = await enqueue("webhooks", { deliveryId }, { jobId: `wh-${deliveryId}`, attempts: 1 });
  if (!ok) return { ok: false, error: "The queue is unavailable. Is the worker running?" };
  refresh(workspaceSlug);
  return { ok: true, message: "Test event sent" };
}
