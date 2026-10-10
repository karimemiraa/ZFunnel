import { getDb, schema } from "@zfunnel/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies, toNextJsHandler } from "better-auth/next-js";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
  appName: "ZFunnel",
  database: drizzleAdapter(getDb(), { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  // Brute-force protection for sign-in/sign-up. AUTH_RATE_LIMIT=off exists only for
  // automated end-to-end tests that create many accounts from one IP; never set it in production.
  rateLimit: {
    enabled: process.env.AUTH_RATE_LIMIT !== "off" && process.env.NODE_ENV === "production",
    window: 60,
    max: 100,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      creatorRole: "owner",
    }),
    // Must be last: lets server actions set auth cookies.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;

/** Route handlers for app/api/auth/[...all]/route.ts. */
export const authHandlers = () => toNextJsHandler(auth);
