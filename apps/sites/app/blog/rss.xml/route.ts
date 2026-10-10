import { publishedPosts } from "@/lib/blog";
import { requestOrigin } from "@/lib/customer";
import { currentWorkspace } from "@/lib/site";
import { getTranslator } from "@zfunnel/i18n";

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET(req: Request) {
  const ws = await currentWorkspace();
  if (!ws) return new Response("Not found", { status: 404 });
  const origin = requestOrigin(req.headers);
  const items = (await publishedPosts(ws.id, 50))
    .map(
      (p) =>
        `<item><title>${x(p.title)}</title><link>${origin}/blog/${p.slug}</link><guid>${origin}/blog/${p.slug}</guid>${p.publishedAt ? `<pubDate>${p.publishedAt.toUTCString()}</pubDate>` : ""}<description>${x(p.excerpt)}</description></item>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${x(ws.name)}</title><link>${origin}/blog</link><description>${x(getTranslator(ws.siteLocale)("blog.feedDescription", { name: ws.name }))}</description><language>${ws.siteLocale}</language>${items}</channel></rss>`;
  return new Response(xml, {
    headers: { "content-type": "application/rss+xml; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}
