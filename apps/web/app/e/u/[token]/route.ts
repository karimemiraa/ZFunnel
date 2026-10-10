import { emailMessages, eq, getDb, withSystem, workspaces } from "@zfunnel/db";
import { verifyToken } from "@zfunnel/email";
import { dir, getTranslator, isLocale, type Locale } from "@zfunnel/i18n";
import { unsubscribeByMessage } from "@/lib/email-tracking";

/** The sender's site language, so the page matches the email it came from. */
async function localeFor(messageId: string | null): Promise<Locale> {
  if (!messageId) return "en";
  const [row] = await withSystem(getDb(), (tx) =>
    tx
      .select({ locale: workspaces.siteLocale })
      .from(emailMessages)
      .innerJoin(workspaces, eq(workspaces.id, emailMessages.workspaceId))
      .where(eq(emailMessages.id, messageId)),
  );
  return isLocale(row?.locale) ? row.locale : "en";
}

const page = (locale: Locale, title: string, body: string, form?: string) =>
  new Response(
    `<!doctype html><html lang="${locale}" dir="${dir(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;background:#f4f4f7;font-family:system-ui,-apple-system,Segoe UI,Roboto,Tahoma,sans-serif;color:#1f2330}
.card{background:#fff;border-radius:16px;padding:40px 32px;max-width:420px;margin:16px;text-align:center;box-shadow:0 20px 50px -25px rgba(0,0,0,.25)}
h1{font-size:22px;margin:0 0 8px}p{color:#6b7280;line-height:1.6;margin:0 0 20px}button{background:#4f46e5;color:#fff;border:0;border-radius:10px;padding:12px 22px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit}</style></head>
<body><div class="card"><h1>${title}</h1><p>${body}</p>${form ?? ""}</div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } },
  );

/** Confirmation page: link scanners (Outlook, antivirus) follow GET links, so GET alone never unsubscribes. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const id = verifyToken("u", (await params).token);
  const locale = await localeFor(id);
  const t = getTranslator(locale);
  if (!id) return page(locale, t("emails.unsubLinkExpired"), t("emails.unsubInvalid"));
  return page(
    locale,
    t("emails.unsubTitle"),
    t("emails.unsubText"),
    `<form method="post"><button type="submit">${t("emails.unsubButton")}</button></form>`,
  );
}

/** Form submit and RFC 8058 one-click unsubscribe (Gmail/Yahoo POST "List-Unsubscribe=One-Click"). */
export async function POST(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const id = verifyToken("u", (await params).token);
  const locale = await localeFor(id);
  const t = getTranslator(locale);
  if (!id) return page(locale, t("emails.unsubLinkExpired"), t("emails.unsubInvalid"));
  await unsubscribeByMessage(id);
  return page(locale, t("emails.unsubDone"), t("emails.unsubDoneText"));
}
