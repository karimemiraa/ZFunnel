import "server-only";

import { auth } from "@zfunnel/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

/** Returns the signed-in user or redirects to sign-in. */
export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}
