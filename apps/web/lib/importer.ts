import "server-only";
import { convertHtml, rewriteImages, type ImportedPage } from "@zfunnel/blocks/import";
import { and, eq, mediaFiles } from "@zfunnel/db";
import { parsePublicHttpUrl, safeFetch, SafeFetchError } from "@zfunnel/shared/net";
import { createHash } from "node:crypto";
import { inWorkspace } from "./funnels";
import { siteOrigin } from "./urls";
import type { WorkspaceContext } from "./workspaces";

/** Limits for one import (ADR-024). */
export const IMPORT_LIMITS = {
  maxUrls: 10,
  pageBytes: 3_000_000,
  pageTimeoutMs: 15_000,
  imagesPerPage: 30,
  imageBytes: 5_000_000,
  imageTimeoutMs: 10_000,
  imageConcurrency: 6,
};

export type UrlListResult = { ok: true; urls: string[] } | { ok: false; error: "none" | "tooMany"; bad?: string };

/** One URL per line; blank lines and duplicates are ignored. */
export function parseUrlList(text: string): UrlListResult | { ok: false; error: "invalid"; bad: string } {
  const lines = [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  ];
  if (!lines.length) return { ok: false, error: "none" };
  if (lines.length > IMPORT_LIMITS.maxUrls) return { ok: false, error: "tooMany" };
  const urls: string[] = [];
  for (const line of lines) {
    const u = parsePublicHttpUrl(/^[a-z][a-z0-9+.-]*:/i.test(line) ? line : `https://${line}`);
    if (!u) return { ok: false, error: "invalid", bad: line.slice(0, 200) };
    urls.push(u.href);
  }
  return { ok: true, urls };
}

/** Sniffs the real image type from its first bytes; SVG and anything else is refused. */
export function sniffImage(b: Buffer): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (b.toString("ascii", 4, 8) === "ftyp" && /^avi[fs]$/.test(b.toString("ascii", 8, 12))) return "image/avif";
  return null;
}

function decodeHtml(body: Buffer, contentType: string): string {
  const charset = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

export type PageFailure = {
  url: string;
  reason: "blocked" | "timeout" | "too_large" | "http" | "not_html" | "network";
};

/** Fetches and converts one page. Never executes anything from it. */
export async function fetchPage(
  url: string,
): Promise<{ ok: true; page: ImportedPage } | { ok: false; failure: PageFailure }> {
  try {
    const res = await safeFetch(url, {
      timeoutMs: IMPORT_LIMITS.pageTimeoutMs,
      maxBytes: IMPORT_LIMITS.pageBytes,
      accept: "text/html,application/xhtml+xml",
    });
    if (res.contentType && !/html|xml/i.test(res.contentType))
      return { ok: false, failure: { url, reason: "not_html" } };
    return { ok: true, page: convertHtml(decodeHtml(res.body, res.contentType), res.url) };
  } catch (e) {
    const code = e instanceof SafeFetchError ? e.code : "network";
    return { ok: false, failure: { url, reason: code === "redirects" ? "http" : code } };
  }
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
    }),
  );
}

/**
 * Copies a page's images into the workspace's media store and rewrites the page to use them.
 * Images that can't be copied (blocked, too big, not a raster image) keep their original URL.
 */
export async function rehostImages(ctx: WorkspaceContext, imported: ImportedPage) {
  const wanted = imported.images.slice(0, IMPORT_LIMITS.imagesPerPage);
  const map = new Map<string, string>();
  let failed = imported.images.length - wanted.length;
  const origin = siteOrigin(ctx.workspace.slug);
  await pool(wanted, IMPORT_LIMITS.imageConcurrency, async (src) => {
    try {
      const res = await safeFetch(src, {
        timeoutMs: IMPORT_LIMITS.imageTimeoutMs,
        maxBytes: IMPORT_LIMITS.imageBytes,
        accept: "image/avif,image/webp,image/png,image/jpeg,image/gif",
      });
      const type = sniffImage(res.body);
      if (!type) throw new Error("not an image");
      const sha256 = createHash("sha256").update(res.body).digest("hex");
      const id = await inWorkspace(ctx, async (tx) => {
        const [row] = await tx
          .insert(mediaFiles)
          .values({
            workspaceId: ctx.workspace.id,
            contentType: type,
            size: res.body.length,
            sha256,
            data: res.body,
            sourceUrl: src.slice(0, 2000),
          })
          .onConflictDoNothing()
          .returning({ id: mediaFiles.id });
        if (row) return row.id;
        const [existing] = await tx
          .select({ id: mediaFiles.id })
          .from(mediaFiles)
          .where(and(eq(mediaFiles.workspaceId, ctx.workspace.id), eq(mediaFiles.sha256, sha256)));
        return existing!.id;
      });
      map.set(src, `${origin}/api/media/${id}`);
    } catch {
      failed++;
    }
  });
  return { page: rewriteImages(imported.page, map), copied: map.size, failed };
}
