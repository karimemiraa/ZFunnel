import type { CoachSuggestion } from "@zfunnel/db";
import type { Locale } from "@zfunnel/i18n";

export const COACH_SYSTEM = `You are a senior conversion-rate-optimization consultant reviewing a sales funnel.
You get each step's traffic and conversion numbers for a period, plus the copy on each page.
Rules:
- Be concrete: name the step and say exactly what to change (e.g. a new headline angle, moving the form above the fold, adding a guarantee section), not generic advice.
- Base every suggestion on the numbers or the copy you were given. Point to the weakest step first.
- With fewer than about 100 visitors, say the data is thin and favor low-risk changes and split tests over big conclusions.
- Never invent statistics, testimonials or guarantees for the business.
- Write in the language of the page copy.
- Reply with ONLY a JSON object:
{"summary":"2-3 sentences","suggestions":[{"title":"short imperative","step":"exact step name or null","why":"evidence from the data or copy","change":"what to do","impact":"high|medium|low"}]}
Give 3 to 6 suggestions, highest impact first.`;

export type CoachStep = {
  name: string;
  type: string;
  visitors: number;
  conversions: number;
  rate: number;
  tracked: boolean;
  revenue: number;
  copy: string[];
};

/** Builds the coach prompt. Copy is trimmed so a long funnel stays within budget. */
export function coachPrompt(input: {
  funnelName: string;
  days: number;
  currency: string;
  steps: CoachStep[];
  split?: string[];
  /** The dashboard language: the coach answers in it. */
  locale?: Locale;
}) {
  const lines = input.steps.map((s, i) => {
    const conv = s.tracked
      ? `${s.conversions} conversions (${(s.rate * 100).toFixed(1)}%)`
      : "no conversion goal on this step";
    const copy = s.copy
      .map((c) =>
        c
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .join(" | ")
      .slice(0, 1500);
    return `${i + 1}. "${s.name}" (${s.type}): ${s.visitors} unique visitors, ${conv}, revenue ${s.revenue} minor units ${input.currency.toUpperCase()}.\n   Copy: ${copy || "(empty)"}`;
  });
  return [
    `Funnel: "${input.funnelName}". Period: last ${input.days} days.`,
    `Steps in order:\n${lines.join("\n")}`,
    input.split?.length ? `Running split tests:\n${input.split.join("\n")}` : "",
    input.locale === "ar" ? "Write the summary and suggestions in Arabic." : "",
    "Review this funnel and reply with the JSON object.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

const plain = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

/** Parses and sanitizes the model's answer. Returns null if it is unusable. */
export function parseCoach(raw: string, stepNames: string[]) {
  let json: { summary?: unknown; suggestions?: unknown };
  try {
    json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as typeof json;
  } catch {
    return null;
  }
  const names = new Map(stepNames.map((n) => [n.toLowerCase(), n]));
  const suggestions: CoachSuggestion[] = (Array.isArray(json.suggestions) ? json.suggestions : [])
    .slice(0, 6)
    .flatMap((s: Record<string, unknown>) => {
      const title = plain(s?.title, 120);
      const change = plain(s?.change, 600);
      if (!title || !change) return [];
      const impact = s.impact === "high" || s.impact === "low" ? s.impact : "medium";
      // Only step names we sent; anything else becomes funnel-wide advice.
      const step = typeof s.step === "string" ? (names.get(s.step.trim().toLowerCase()) ?? null) : null;
      return [{ title, step, why: plain(s.why, 600), change, impact }];
    });
  const summary = plain(json.summary, 600);
  if (!summary || !suggestions.length) return null;
  return { summary, suggestions };
}
