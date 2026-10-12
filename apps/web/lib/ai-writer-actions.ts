"use server";

import { sanitizeRichText } from "@zfunnel/email";
import { z } from "zod";
import { currentAdmin } from "./admin";
import { aiConfigured, complete, takeAiQuota } from "./ai";
import { cleanWriterOutput, WRITER_ACTIONS, writerPrompt, writerSystem } from "./ai-writer";
import { getT } from "./i18n";
import { requireUser } from "./session";
import { getWorkspaceForUser } from "./workspaces";

type Result = { ok: true; text: string } | { ok: false; error: string };

const schema = z.object({
  action: z.enum(WRITER_ACTIONS),
  format: z.enum(["plain", "html"]),
  text: z.string().trim().min(1).max(6000),
  field: z.string().max(60).optional(),
  context: z.string().max(300).optional(),
});

/** Per admin: at most this many AI writer calls per hour (on top of the per-workspace AI limit). */
const WRITER_PER_HOUR = 60;

/**
 * Rewrites one text field in the page editor. Owner decision (Phase 8): platform admins only
 * (PLATFORM_ADMIN_EMAILS, verified email, ADR-024). The output is in the workspace's site language.
 */
export async function aiWrite(workspaceSlug: string, input: z.input<typeof schema>): Promise<Result> {
  const user = await requireUser();
  const t = await getT();
  if (!(await currentAdmin())) return { ok: false, error: t("aiWriter.adminOnly") };
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) return { ok: false, error: t("ai.workspaceNotFound") };
  if (!aiConfigured()) return { ok: false, error: t("ai.notConfiguredServer") };
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: t("ai.invalidRequest") };
  if (!takeAiQuota(`writer:${user.id}`, WRITER_PER_HOUR) || !takeAiQuota(ctx.workspace.id))
    return { ok: false, error: t("ai.rateLimit") };

  const lang = ctx.workspace.siteLocale;
  const { action, format, text, field, context } = p.data;
  const multiline = format === "plain" && text.includes("\n");
  try {
    const raw = await complete({
      system: writerSystem(lang),
      prompt: writerPrompt({ action, format, text, field, context, lang }),
      maxTokens: format === "html" || multiline ? 1200 : 300,
    });
    let out = cleanWriterOutput(raw, format, multiline);
    if (format === "html") out = sanitizeRichText(out.startsWith("<") ? out : `<p>${out}</p>`);
    if (!out) return { ok: false, error: t("ai.emptyResult") };
    return { ok: true, text: out };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
