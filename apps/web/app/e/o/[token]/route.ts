import { verifyToken } from "@zfunnel/email";
import { recordEngagement } from "@/lib/email-tracking";

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** Open-tracking pixel. Always returns the image, even for bad tokens. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const id = verifyToken("o", (await params).token);
  if (id) await recordEngagement(id, "open").catch(() => {});
  return new Response(GIF, { headers: { "content-type": "image/gif", "cache-control": "no-store, max-age=0" } });
}
