import { BLOCK_HTML, DEFAULT_EMAIL_THEME, EMAIL_FONTS, type Ctx, type EmailBlockType, type EmailTheme } from "./blocks";
import { dir as textDir, getTranslator, type Locale } from "@zfunnel/i18n";
import { esc, htmlToText } from "./html";

export type EmailDoc = {
  root: { props?: Partial<EmailTheme> & Record<string, unknown> };
  content: { type: string; props: Record<string, unknown> }[];
};

export type RenderOptions = {
  preheader?: string;
  /** Personalization values; HTML-escaped on insert. */
  vars?: Record<string, string | number | null | undefined>;
  footer: { fromName: string; postalAddress: string; unsubscribeUrl: string };
  /** Rewrites links for click tracking. */
  rewriteLink?: (url: string) => string;
  openPixelUrl?: string;
  /** Site language: footer text and reading direction. */
  locale?: Locale;
};

/** Email clients don't support logical CSS, so right-to-left emails mirror left/right alignment. */
function mirror(html: string) {
  return html.replace(
    /(text-align:\s*|align=")(left|right)/g,
    (_m, p: string, side: string) => p + (side === "left" ? "right" : "left"),
  );
}

/** Replaces {{var}} and {{var|fallback}}; values are escaped so contact data can't inject HTML. */
export function personalize(input: string, vars: RenderOptions["vars"] = {}, escapeValues = true) {
  return input.replace(/\{\{\s*([a-z0-9_]+)\s*(?:\|\s*([^}]*))?\}\}/gi, (_m, key: string, fallback?: string) => {
    const v = vars[key.toLowerCase()];
    const s = v === null || v === undefined || v === "" ? (fallback ?? "").trim() : String(v);
    return escapeValues ? esc(s) : s;
  });
}

export function renderEmail(doc: EmailDoc, opts: RenderOptions) {
  const theme: EmailTheme = { ...DEFAULT_EMAIL_THEME, ...(doc.root?.props ?? {}) };
  const ctx: Ctx = { theme, font: EMAIL_FONTS[theme.font]?.stack ?? EMAIL_FONTS.system.stack };
  const rows = (doc.content ?? [])
    .map((b) => {
      const fn = BLOCK_HTML[b.type as EmailBlockType] as ((p: unknown, c: Ctx) => string) | undefined;
      return fn ? fn(b.props, ctx) : "";
    })
    .join("\n");
  let body = personalize(rows, opts.vars);
  if (opts.rewriteLink)
    body = body.replace(
      /href="(https?:\/\/[^"]+)"/g,
      (_m, url: string) => `href="${esc(opts.rewriteLink!(url.replace(/&amp;/g, "&")))}"`,
    );
  const locale = opts.locale ?? "en";
  const rtl = textDir(locale) === "rtl";
  if (rtl) body = mirror(body);
  const t = getTranslator(locale);
  const pre = personalize(opts.preheader ?? "", opts.vars);
  const f = opts.footer;
  const html = `<!doctype html>
<html lang="${locale}" dir="${textDir(locale)}" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title></title>
</head>
<body style="margin:0;padding:0;background:${theme.background};-webkit-text-size-adjust:100%">
${pre ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${pre}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" dir="${textDir(locale)}" style="background:${theme.background}">
<tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${theme.card};border-radius:14px">
<tr><td style="height:24px;line-height:1px;font-size:1px">&nbsp;</td></tr>
${body}
<tr><td style="height:16px;line-height:1px;font-size:1px">&nbsp;</td></tr>
</table>
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td align="center" style="padding:24px 40px;font-family:${ctx.font};font-size:12px;line-height:18px;color:#8a8f9c">
${esc(f.fromName)} · ${esc(f.postalAddress)}<br>
${esc(t("emails.footerReason", { name: f.fromName }))} <a href="${esc(f.unsubscribeUrl)}" style="color:#8a8f9c;text-decoration:underline">${esc(t("emails.unsubscribe"))}</a>
</td></tr>
</table>
</td></tr>
</table>
${opts.openPixelUrl ? `<img src="${esc(opts.openPixelUrl)}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">` : ""}
</body>
</html>`;
  return {
    html,
    text:
      htmlToText(body) + `\n\n—\n${f.fromName} · ${f.postalAddress}\n${t("emails.unsubscribe")}: ${f.unsubscribeUrl}`,
  };
}
