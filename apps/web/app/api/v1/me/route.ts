import { authenticate } from "@/lib/api-auth";

/** Check that a key works: returns the workspace it belongs to. */
export async function GET(req: Request) {
  const a = await authenticate(req);
  if (a instanceof Response) return a;
  return Response.json({ workspace: { id: a.workspaceId, name: a.workspaceName } });
}
