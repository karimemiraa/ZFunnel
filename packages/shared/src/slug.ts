/** Subdomain labels reserved for the platform itself. */
export const RESERVED_SLUGS = new Set([
  "app",
  "api",
  "www",
  "admin",
  "mail",
  "email",
  "smtp",
  "help",
  "support",
  "docs",
  "status",
  "blog",
  "cdn",
  "assets",
  "static",
  "auth",
  "login",
  "billing",
  "dashboard",
  "account",
]);

/** Turns a free-text name into a DNS-safe subdomain label (max 48 chars). */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}
