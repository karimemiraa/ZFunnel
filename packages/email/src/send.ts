import nodemailer, { type Transporter } from "nodemailer";

/**
 * SMTP sending: works with Amazon SES (SMTP), Postmark, Resend, Mailgun, Postal or
 * Mailpit locally. Configure SMTP_URL, e.g. smtps://user:pass@email-smtp.eu-central-1.amazonaws.com:465
 */
let transport: Transporter | null = null;

export function emailConfigured() {
  return Boolean(process.env.SMTP_URL);
}

function getTransport() {
  if (!transport) {
    if (!process.env.SMTP_URL) throw new Error("SMTP_URL is not set");
    // Send rate is limited by the worker (BullMQ limiter), so one plain connection setup is enough.
    transport = nodemailer.createTransport(process.env.SMTP_URL);
  }
  return transport;
}

/** The platform's sending address; replies go to the workspace's own reply-to. */
export function fromAddress(fromName: string) {
  const addr =
    process.env.EMAIL_FROM ?? `hello@mail.${(process.env.ROOT_DOMAIN ?? "zfunnel.app").replace(/:\d+$/, "")}`;
  return { name: fromName.replace(/[\r\n"<>]/g, "").slice(0, 80), address: addr };
}

export type SendInput = {
  fromName: string;
  replyTo: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  unsubscribeUrl: string;
  unsubscribePostUrl: string;
  messageId: string;
};

export async function sendEmail(input: SendInput) {
  const info = await getTransport().sendMail({
    from: fromAddress(input.fromName),
    replyTo: input.replyTo,
    to: input.to,
    subject: input.subject.replace(/[\r\n]+/g, " "),
    html: input.html,
    text: input.text,
    headers: {
      // RFC 8058 one-click unsubscribe (required by Gmail/Yahoo for bulk senders).
      "List-Unsubscribe": `<${input.unsubscribePostUrl}>, <${input.unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      "X-ZFunnel-Message": input.messageId,
    },
  });
  return { providerMessageId: info.messageId };
}

/** 5xx SMTP responses are permanent failures (bad address, mailbox gone). */
export function isHardBounce(err: unknown) {
  const code = (err as { responseCode?: number }).responseCode;
  return typeof code === "number" && code >= 500 && code < 600;
}
