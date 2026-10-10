import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for third-party credentials stored in the database (e.g. Twilio tokens).
 * The key is derived from SECRETS_KEY, falling back to BETTER_AUTH_SECRET.
 * Format: v1.<iv>.<tag>.<ciphertext> (base64url).
 */
function key() {
  const s = process.env.SECRETS_KEY ?? process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("SECRETS_KEY or BETTER_AUTH_SECRET must be set");
  return createHash("sha256").update(`zfunnel-secrets:${s}`).digest();
}

export function sealSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function openSecret(sealed: string): string | null {
  const [v, iv, tag, enc] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !enc) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
