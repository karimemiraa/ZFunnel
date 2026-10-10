import { sitePaths } from "@/lib/blog";
import { requestOrigin } from "@/lib/customer";
import { currentWorkspace } from "@/lib/site";

export async function GET(req: Request) {
  const ws = await currentWorkspace();
  if (!ws) return new Response("Not found", { status: 404 });
  const origin = requestOrigin(req.headers);
  const urls = (await sitePaths(ws.id))
    .map((u) => `<url><loc>${origin}${u.path}</loc>${u.at ? `<lastmod>${u.at.toISOString()}</lastmod>` : ""}</url>`)
    .join("");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`,
    {
      headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" },
    },
  );
}
