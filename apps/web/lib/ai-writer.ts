import type { Locale } from "@zfunnel/i18n";

/**
 * AI writer in the page editor (8.5j). Pure helpers: prompt building and output cleanup.
 * The server action (ai-writer-actions.ts) adds the platform-admin guard and the rate limit.
 */
export const WRITER_ACTIONS = ["rewrite", "shorten", "expand", "persuasive", "grammar"] as const;
export type WriterAction = (typeof WRITER_ACTIONS)[number];

const TASKS: Record<WriterAction, string> = {
  rewrite: "Rewrite it with fresh wording. Keep the meaning, the facts and roughly the same length.",
  shorten: "Make it noticeably shorter (about half the length) while keeping the core message.",
  expand: "Expand it with more concrete detail and benefits, about twice the length. Add no new facts.",
  persuasive:
    "Make it more persuasive: lead with the reader's benefit, be specific, use active voice and a clear call to action where it fits.",
  grammar:
    "Fix spelling, grammar and punctuation only. Keep the wording, tone and length; change as little as possible.",
};

export function writerSystem(lang: Locale) {
  const language =
    lang === "ar"
      ? `Write in Arabic: Modern Standard Arabic in a warm, direct marketing voice, the way a native Arab copywriter writes it.
Write it natively. Never translate from English or keep English sentence structure; rephrase until it reads naturally.
Address the reader as «أنت» (masculine singular). Use Western digits (0-9). Keep brand and product names as they are.
If the original is in English, write a native Arabic version of the same idea, not a translation.`
      : "Write in English. If the original is in another language, write a natural English version of the same idea.";
  return `You are a world-class direct-response copywriter working inside a funnel page builder.
${language}
Never invent facts, prices, guarantees, statistics or testimonials that are not in the original text.
Return ONLY the new copy: no preamble, no quotes, no explanations, no markdown.`;
}

export function writerPrompt(input: {
  action: WriterAction;
  text: string;
  format: "plain" | "html";
  /** The field being edited, e.g. "Headline" or "Answer". */
  field?: string;
  /** Where it appears, e.g. "sales page in a funnel called Launch". */
  context?: string;
  lang: Locale;
}) {
  const multiline = input.format === "plain" && input.text.includes("\n");
  const formatRule =
    input.format === "html"
      ? "Format: simple HTML using only <p>, <strong>, <em>, <ul>, <li> and <a href>. Keep existing links. No other tags, no styles."
      : multiline
        ? "Format: plain text. Keep the same line structure (one item per line)."
        : "Format: a single line of plain text.";
  return [
    `Field: ${input.field || "text"}${input.context ? ` on a ${input.context}` : ""}.`,
    `Site language: ${input.lang === "ar" ? "Arabic" : "English"}.`,
    `Current copy:\n${input.text}`,
    `Task: ${TASKS[input.action]}`,
    formatRule,
  ].join("\n\n");
}

/** Strips code fences, wrapping quotes and (for single-line fields) extra lines. */
export function cleanWriterOutput(raw: string, format: "plain" | "html", multiline: boolean) {
  let out = raw.replace(/^```[a-z]*\n?|```$/g, "").trim();
  if (format === "html") return out;
  out = out.replace(/<[^>]+>/g, "");
  if (!multiline) out = out.split("\n")[0]!;
  return out
    .trim()
    .replace(/^["“”'«»]+|["“”'«»]+$/g, "")
    .trim();
}

/** Prop names that hold URLs, ids, colours or code rather than copy: the writer skips them. */
const NOT_COPY = new Set(
  "url href link src image img logo video embed color colour id slug tag tags email html code script css class font icon key price amount currency date time zone width height size style variant background redirect webhook domain".split(
    " ",
  ),
);
export function isCopyField(name: string) {
  const last =
    name
      .split(/[.[\]]/)
      .filter(Boolean)
      .pop() ?? name;
  const words = last
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[\s_-]+/);
  return !words.some((w) => NOT_COPY.has(w));
}
