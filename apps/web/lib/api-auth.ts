import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { apiKeys, eq, getDb, sql, withSystem, withWorkspace, workspaces, type Tx } from "@zfunnel/db";

export const newApiKey = () => `zf_${randomBytes(24).toString("base64url")}`;
export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");

export type ApiCtx = { workspaceId: string; organizationId: string; workspaceName: string; keyId: string };

const hits = new Map<string, { minute: number; n: number }>();
function rateLimited(keyId: string, perMinute = 120) {
  const minute = Math.floor(Date.now() / 60_000);
  const h = hits.get(keyId);
  if (!h || h.minute !== minute) {
    hits.set(keyId, { minute, n: 1 });
    return false;
  }
  return ++h.n > perMinute;
}

export const apiError = (status: number, message: string) => Response.json({ error: { message } }, { status });

/** Resolves `Authorization: Bearer zf_…` to a workspace, or returns an error response. */
export async function authenticate(req: Request): Promise<ApiCtx | Response> {
  const key = /^Bearer\s+(zf_[A-Za-z0-9_-]{20,64})$/.exec(req.headers.get("authorization") ?? "")?.[1];
  if (!key) return apiError(401, "Missing or malformed API key. Send Authorization: Bearer zf_…");
  const row = await withSystem(getDb(), async (tx) => {
    const [r] = await tx
      .select({
        id: apiKeys.id,
        workspaceId: apiKeys.workspaceId,
        revokedAt: apiKeys.revokedAt,
        lastUsedAt: apiKeys.lastUsedAt,
        organizationId: workspaces.organizationId,
        name: workspaces.name,
      })
      .from(apiKeys)
      .innerJoin(workspaces, eq(workspaces.id, apiKeys.workspaceId))
      .where(eq(apiKeys.hash, hashKey(key)));
    if (r && !r.revokedAt && (!r.lastUsedAt || Date.now() - r.lastUsedAt.getTime() > 60_000))
      await tx
        .update(apiKeys)
        .set({ lastUsedAt: sql`now()` })
        .where(eq(apiKeys.id, r.id));
    return r;
  });
  if (!row || row.revokedAt) return apiError(401, "Invalid or revoked API key.");
  if (rateLimited(row.id)) return apiError(429, "Rate limit exceeded (120 requests per minute).");
  return { workspaceId: row.workspaceId, organizationId: row.organizationId, workspaceName: row.name, keyId: row.id };
}

export function inApi<T>(ctx: ApiCtx, fn: (tx: Tx) => Promise<T>) {
  return withWorkspace(getDb(), { organizationId: ctx.organizationId, workspaceId: ctx.workspaceId }, fn);
}

export async function readJson(req: Request) {
  try {
    return (await req.json()) as unknown;
  } catch {
    return null;
  }
}
