import { verifyToken } from "@zfunnel/email";
import { recordEngagement } from "@/lib/email-tracking";

/** Click tracking redirect. Only http(s) destinations; never an open redirect for bad tokens. */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const id = verifyToken("c", (await params).token);
  const target = new URL(req.url).searchParams.get("u") ?? "";
  let dest: URL | null = null;
  try {
    dest = new URL(target);
  } catch {
    dest = null;
  }
  if (!id || !dest || !/^https?:$/.test(dest.protocol)) return new Response("Invalid link", { status: 400 });
  await recordEngagement(id, "click", dest.toString()).catch(() => {});
  return Response.redirect(dest.toString(), 302);
}
