import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "./rate-limit";
import { currentWorkspace } from "./site";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Common guard for public POST endpoints: rate limit + resolve the workspace from the host. */
export async function publicPost(req: Request, bucket: string, limit = 20) {
  const ip = clientIp(req.headers);
  if (!rateLimit(`${bucket}:${ip}`, limit, 60_000))
    return { error: jsonError("Too many attempts. Please wait a minute.", 429) } as const;
  const ws = await currentWorkspace();
  if (!ws) return { error: jsonError("Site not found.", 404) } as const;
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
