import { renderEmail, type EmailDoc } from "@zfunnel/email";
import { getEmailDesign, getEmailSettings } from "@/lib/email";
import { requireUser } from "@/lib/session";
import { getWorkspaceForUser } from "@/lib/workspaces";

/** Renders the exact HTML that will be sent, with sample personalization. Members only. */
export async function GET(_req: Request, { params }: { params: Promise<{ workspace: string; emailId: string }> }) {
  const [{ workspace, emailId }, user] = await Promise.all([params, requireUser()]);
  const ctx = await getWorkspaceForUser(user.id, workspace);
  if (!ctx) return new Response("Not found", { status: 404 });
  const [email, settings] = await Promise.all([getEmailDesign(ctx, emailId), getEmailSettings(ctx)]);
  if (!email) return new Response("Not found", { status: 404 });
  const { html } = renderEmail(email.content as EmailDoc, {
    preheader: email.preheader,
    vars: { first_name: user.name?.split(" ")[0] ?? "", email: user.email, name: user.name },
    footer: {
      fromName: settings?.fromName ?? ctx.workspace.name,
      postalAddress: settings?.postalAddress ?? "Your postal address",
      unsubscribeUrl: "#",
    },
    locale: ctx.workspace.siteLocale,
  });
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "script-src 'none'",
    },
  });
}
