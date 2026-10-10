"use server";

import { sanitizeRichText } from "@zfunnel/email";
import { z } from "zod";
import { aiConfigured, complete, takeAiQuota } from "./ai";
import { enforce } from "./billing";
import { requireUser } from "./session";
import { getWorkspaceForUser } from "./workspaces";

type Result = { ok: true; text: string } | { ok: false; error: string };

const schema = z.object({
  format: z.enum(["plain", "html"]),
  /** What the text is: "headline", "paragraph", "button", "email subject"… */
  role: z.string().max(40),
  text: z.string().max(6000),
  instruction: z.string().trim().min(1).max(500),
  /** Where it appears, e.g. "sales page for an online course" or "welcome email". */
  context: z.string().max(300).optional(),
});

const SYSTEM = `You are a world-class direct-response copywriter working inside a funnel builder.
Write clear, specific, benefit-driven copy in the same language as the original text (English if there is none).
Never invent facts, prices, guarantees, statistics or testimonials that are not in the original text or instruction.
Return ONLY the new copy: no preamble, no quotes, no explanations, no markdown.`;

export async function aiRewrite(workspaceSlug: string, input: z.input<typeof schema>): Promise<Result> {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) return { ok: false, error: "Workspace not found" };
  if (!aiConfigured()) return { ok: false, error: "AI isn't set up on this server yet (ANTHROPIC_API_KEY)." };
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, error: "Invalid request" };
  const blocked = await enforce(ctx.membership.organizationId, "ai");
  if (blocked) return { ok: false, error: blocked };
  if (!takeAiQuota(ctx.workspace.id))
    return { ok: false, error: "You've reached the hourly AI limit. Try again later." };
  const { format, role, text, instruction, context } = p.data;
  const formatRule =
    format === "html"
      ? "Format: simple HTML using only <p>, <strong>, <em>, <ul>, <li> and <a href>. No other tags, no styles."
      : role === "headline" || role === "button" || role === "email subject"
        ? "Format: a single line of plain text, no trailing period for headlines and buttons."
        : "Format: plain text.";
  const prompt = [
    `Element: ${role}${context ? ` on a ${context}` : ""}.`,
    text.trim() ? `Current copy:\n${text}` : "There is no copy yet.",
    `Task: ${instruction}`,
    formatRule,
  ].join("\n\n");
  try {
    let out = await complete({ system: SYSTEM, prompt, maxTokens: format === "html" ? 900 : 200 });
    out = out.replace(/^```[a-z]*\n?|```$/g, "").trim();
    if (format === "html") out = sanitizeRichText(out.startsWith("<") ? out : `<p>${out}</p>`);
    else
      out = out
        .replace(/<[^>]+>/g, "")
        .replace(/^["“”']+|["“”']+$/g, "")
        .split("\n")[0]!
        .trim();
    if (!out) return { ok: false, error: "The AI returned nothing. Try a different instruction." };
    return { ok: true, text: out };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
