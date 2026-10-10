import { and, eq, getDb, mediaFiles, withSystem } from "@zfunnel/db";
import { z } from "zod";
import { currentWorkspace } from "@/lib/site";

/** Raster types only: SVG can carry script, so it is never stored or served (ADR-025). */
const SAFE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif"]);

/** Serves an image copied into this workspace (e.g. by the ClickFunnels importer). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await currentWorkspace();
  if (!ws || !z.string().uuid().safeParse(id).success) return new Response(null, { status: 404 });
  // The public renderer has no tenant session: scope explicitly to the host's workspace.
  const [file] = await withSystem(getDb(), (tx) =>
    tx
      .select({ contentType: mediaFiles.contentType, data: mediaFiles.data })
      .from(mediaFiles)
      .where(and(eq(mediaFiles.id, id), eq(mediaFiles.workspaceId, ws.id))),
  );
  if (!file || !SAFE_TYPES.has(file.contentType)) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "content-type": file.contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "cross-origin-resource-policy": "cross-origin",
    },
  });
}
