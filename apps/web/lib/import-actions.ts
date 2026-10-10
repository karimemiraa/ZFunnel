"use server";

import type { PageData } from "@zfunnel/blocks";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { enforce } from "./billing";
import { createFunnelWithSteps, type StepType } from "./funnels";
import { getT } from "./i18n";
import { fetchPage, IMPORT_LIMITS, parseUrlList, rehostImages, type PageFailure } from "./importer";
import { requireUser } from "./session";
import { getWorkspaceForUser, recordAudit } from "./workspaces";

export type ImportState = {
  error?: string;
  fieldErrors?: { name?: string; urls?: string; confirm?: string };
  done?: {
    funnelId: string;
    steps: { name: string; type: StepType; blocks: number; customHtml: number }[];
    imagesCopied: number;
    imagesFailed: number;
  };
} | null;

/** One import at a time per workspace: imports are slow and fetch from the internet. */
const running = new Set<string>();

/**
 * Imports published pages (ClickFunnels or any HTML page) into a new funnel, one step per URL.
 * Runs synchronously with hard limits (ADR-025).
 */
export async function importFunnel(
  workspaceSlug: string,
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const user = await requireUser();
  const t = await getT();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error(t("ai.workspaceNotFound"));

  const name = z.string().trim().min(2).max(80).safeParse(formData.get("name"));
  const urls = parseUrlList(String(formData.get("urls") ?? "").slice(0, 20_000));
  const fieldErrors: NonNullable<ImportState>["fieldErrors"] = {};
  if (!name.success) fieldErrors.name = t("funnels.errors.atLeast2");
  if (!urls.ok)
    fieldErrors.urls =
      urls.error === "none"
        ? t("importer.err.noUrls")
        : urls.error === "tooMany"
          ? t("importer.err.tooMany", { max: IMPORT_LIMITS.maxUrls })
          : t("importer.err.invalidUrl", { url: urls.bad ?? "" });
  if (formData.get("confirm") !== "on") fieldErrors.confirm = t("importer.err.confirm");
  if (!name.success || !urls.ok || fieldErrors.confirm) return { fieldErrors };

  const blocked = await enforce(ctx.membership.organizationId, "funnels");
  if (blocked) return { error: blocked };
  if (running.has(ctx.workspace.id)) return { error: t("importer.err.busy") };
  running.add(ctx.workspace.id);
  try {
    // 1. Fetch and convert every page first, so nothing is created if one fails.
    const results = [];
    for (const url of urls.urls) results.push(await fetchPage(url));
    const failures = results.flatMap((r) => (r.ok ? [] : [r.failure]));
    if (failures.length) return { error: failureMessage(t, failures[0]!) };
    const pages = results.flatMap((r) => (r.ok ? [r.page] : []));

    // 2. Copy images into our storage, page by page.
    let imagesCopied = 0;
    let imagesFailed = 0;
    const steps: [string, StepType, PageData][] = [];
    const summary: NonNullable<NonNullable<ImportState>["done"]>["steps"] = [];
    for (const [i, p] of pages.entries()) {
      const { page, copied, failed } = await rehostImages(ctx, p);
      imagesCopied += copied;
      imagesFailed += failed;
      const stepName = (p.title || t("importer.pageN", { n: i + 1 })).slice(0, 60);
      steps.push([stepName, p.stepType, page]);
      summary.push({ name: stepName, type: p.stepType, blocks: p.stats.blocks, customHtml: p.stats.customHtml });
    }

    // 3. Create the funnel with one step per URL, in order.
    const funnel = await createFunnelWithSteps(ctx, name.data, { steps });
    await recordAudit(ctx, user.id, {
      action: "funnel.imported",
      entityType: "funnel",
      entityId: funnel.id,
      data: { name: funnel.name, pages: urls.urls.length, imagesCopied, imagesFailed },
    });
    revalidatePath(`/${workspaceSlug}/funnels`);
    return { done: { funnelId: funnel.id, steps: summary, imagesCopied, imagesFailed } };
  } finally {
    running.delete(ctx.workspace.id);
  }
}

function failureMessage(t: Awaited<ReturnType<typeof getT>>, f: PageFailure) {
  const reason = {
    blocked: t("importer.err.reasonBlocked"),
    timeout: t("importer.err.reasonTimeout"),
    too_large: t("importer.err.reasonTooLarge"),
    http: t("importer.err.reasonHttp"),
    not_html: t("importer.err.reasonNotHtml"),
    network: t("importer.err.reasonNetwork"),
  }[f.reason];
  return t("importer.err.pageFailed", { url: f.url.slice(0, 200), reason });
}
