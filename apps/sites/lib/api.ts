import type { MessageKey } from "@zfunnel/i18n";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "./rate-limit";
import { getT } from "./i18n";
import { currentWorkspace } from "./site";

/**
 * Error response for visitors. `errors.*` keys are translated into the site's language;
 * any other text (e.g. a payment provider's message) is passed through as is.
 */
export async function jsonError(message: string, status = 400) {
  const text = message.startsWith("errors.") ? (await getT())(message as MessageKey) : message;
  return NextResponse.json({ error: text }, { status });
}

/** Common guard for public POST endpoints: rate limit + resolve the workspace from the host. */
export async function publicPost(req: Request, bucket: string, limit = 20) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`${bucket}:${ip}`, limit, 60_000)) return { error: jsonError("errors.tooManyAttempts", 429) } as const;
  const ws = await currentWorkspace();
  if (!ws) return { error: jsonError("errors.siteNotFound", 404) } as const;
  const body = (await req.json().catch(() => null)) as unknown;
  return { ws, ip, body } as const;
}

export const sessionCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 6 * 60 * 60,
};
