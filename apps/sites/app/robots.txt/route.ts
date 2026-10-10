import { requestOrigin } from "@/lib/customer";

export function GET(req: Request) {
  const body = `User-agent: *\nDisallow: /api/\nDisallow: /account\nDisallow: /courses\n\nSitemap: ${requestOrigin(req.headers)}/sitemap.xml\n`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
