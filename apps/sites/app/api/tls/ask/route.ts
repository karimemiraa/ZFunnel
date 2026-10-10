import { isPlatformHost } from "@/lib/host";
import { ROOT_DOMAIN, workspaceForHost } from "@/lib/site";

/**
 * Caddy on-demand TLS "ask" endpoint: Caddy calls this before issuing a certificate,
 * so certificates are only requested for hosts we actually serve (prevents abuse
 * and Let's Encrypt rate-limit exhaustion).
 */
export async function GET(req: Request) {
  const domain = new URL(req.url).searchParams.get("domain")?.toLowerCase();
  if (!domain || domain.length > 253) return new Response("missing domain", { status: 400 });
  // The platform's own hosts (root, app., sites.) also go through this policy.
  if (isPlatformHost(domain, ROOT_DOMAIN)) return new Response("ok");
  const ws = await workspaceForHost(domain);
  return ws ? new Response("ok") : new Response("unknown host", { status: 404 });
}
