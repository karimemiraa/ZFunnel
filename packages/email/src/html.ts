import sanitize from "sanitize-html";

export const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Only http(s), mailto and template-variable URLs survive. */
export function safeHref(url: string) {
  const u = String(url ?? "").trim();
  if (/^(https?:\/\/|mailto:|\{\{[a-z_]+\}\})/i.test(u)) return u;
  if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(u)) return `https://${u}`;
  return "#";
}

/**
 * Cleans rich text from the editor down to tags every email client understands,
 * and inlines the styles they need (email clients ignore <style> blocks unevenly).
 */
export function emailRichText(html: string, theme: { text: string; link: string; font: string }) {
  const clean = sanitize(String(html ?? ""), {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "h1", "h2", "h3", "blockquote"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: (tag, attribs) => ({
        tagName: "a",
        attribs: { href: safeHref(attribs.href ?? ""), style: `color:${theme.link};text-decoration:underline` },
      }),
    },
  });
  const p = `margin:0 0 16px;font-family:${theme.font};font-size:16px;line-height:26px;color:${theme.text}`;
  return clean
    .replace(/<p>/g, `<p style="${p}">`)
    .replace(/<(ul|ol)>/g, `<$1 style="margin:0 0 16px;padding-left:24px;${p.replace("margin:0 0 16px;", "")}">`)
    .replace(/<li>/g, `<li style="margin:0 0 6px">`)
    .replace(
      /<h([123])>/g,
      (_m, n) =>
        `<h${n} style="margin:0 0 12px;font-family:${theme.font};font-size:${n === "1" ? 28 : n === "2" ? 22 : 18}px;line-height:1.3;color:${theme.text}">`,
    )
    .replace(
      /<blockquote>/g,
      `<blockquote style="margin:0 0 16px;padding-left:16px;border-left:3px solid ${theme.link};${p.replace("margin:0 0 16px;", "")}">`,
    );
}

/** Plain-text alternative (improves deliverability and accessibility). */
export function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(
      /<a [^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_m, href, text) => `${text.replace(/<[^>]+>/g, "")} (${href})`,
    )
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/tr)[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Generic rich-text sanitizer (AI output, pasted HTML): basic formatting and safe links only. */
export function sanitizeRichText(html: string) {
  return sanitize(String(html ?? ""), {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a"],
    allowedAttributes: { a: ["href"] },
    allowedSchemes: ["http", "https", "mailto"],
  }).trim();
}
