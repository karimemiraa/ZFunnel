import "server-only";

import { desc, eq, posts } from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import type { WorkspaceContext } from "./workspaces";

export async function listPosts(ctx: WorkspaceContext) {
  return inWorkspace(ctx, (tx) => tx.select().from(posts).orderBy(desc(posts.updatedAt)));
}

export async function getPost(ctx: WorkspaceContext, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [p] = await inWorkspace(ctx, (tx) => tx.select().from(posts).where(eq(posts.id, id)));
  return p ?? null;
}
