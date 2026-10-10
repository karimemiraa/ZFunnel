/**
 * Form / survey / quiz logic shared by the block (browser) and the submit API (server).
 * The server always re-reads the definition from the published page; it never trusts the client's copy.
 */
export type QuestionType =
  "short_text" | "long_text" | "email" | "phone" | "number" | "single_choice" | "multiple_choice" | "dropdown";

export type Question = {
  label: string;
  type: QuestionType;
  required: boolean;
  /** One option per line. In quizzes, "Option | 3" gives the option 3 points. */
  options: string;
  /** Where the answer is saved on the contact: "", "name", "phone" or a custom field key. */
  saveTo: string;
};

export type Outcome = { minScore: number; title: string; tag: string; redirect: string };

export type SurveyDef = {
  formName: string;
  questions: Question[];
  askEmail: boolean;
  tag: string;
  quiz: boolean;
  outcomes: Outcome[];
};

export type Option = { label: string; points: number };
export type Answers = Record<string, string | string[]>;

export const isChoice = (t: QuestionType) => t === "single_choice" || t === "multiple_choice" || t === "dropdown";

export function parseOptions(text: string): Option[] {
  return (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((l) => {
      const m = /^(.*?)\s*\|\s*(-?\d+)\s*$/.exec(l);
      return m ? { label: m[1]!.trim(), points: Number(m[2]) } : { label: l, points: 0 };
    });
}

/** Stable key per question so answers survive label edits within one published version. */
export const questionKey = (i: number) => `q${i + 1}`;

export type Cleaned = { key: string; label: string; type: QuestionType; value: string | string[]; saveTo: string }[];

/** Validates answers against the definition. Returns cleaned answers or the first error. */
export function validateAnswers(
  def: SurveyDef,
  answers: Answers,
): { ok: true; answers: Cleaned } | { ok: false; error: string } {
  const out: Cleaned = [];
  for (const [i, q] of def.questions.entries()) {
    const key = questionKey(i);
    const raw = answers[key];
    const label = q.label || `Question ${i + 1}`;
    if (q.type === "multiple_choice") {
      const opts = parseOptions(q.options).map((o) => o.label);
      const vals = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String).filter((v) => opts.includes(v));
      if (q.required && !vals.length) return { ok: false, error: `Please answer: ${label}` };
      if (vals.length) out.push({ key, label, type: q.type, value: [...new Set(vals)], saveTo: q.saveTo });
      continue;
    }
    const v =
      (Array.isArray(raw) ? raw[0] : raw)
        ?.toString()
        .trim()
        .slice(0, q.type === "long_text" ? 5000 : 500) ?? "";
    if (!v) {
      if (q.required) return { ok: false, error: `Please answer: ${label}` };
      continue;
    }
    if (isChoice(q.type) && !parseOptions(q.options).some((o) => o.label === v))
      return { ok: false, error: `Please choose an option for: ${label}` };
    if (q.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
      return { ok: false, error: `Please enter a valid email for: ${label}` };
    if (q.type === "number" && !Number.isFinite(Number(v)))
      return { ok: false, error: `Please enter a number for: ${label}` };
    out.push({ key, label, type: q.type, value: v, saveTo: q.saveTo });
  }
  return { ok: true, answers: out };
}

export function scoreAnswers(def: SurveyDef, answers: Cleaned) {
  let score = 0;
  for (const a of answers) {
    const i = Number(a.key.slice(1)) - 1;
    const q = def.questions[i];
    if (!q || !isChoice(q.type)) continue;
    const opts = parseOptions(q.options);
    for (const v of Array.isArray(a.value) ? a.value : [a.value]) score += opts.find((o) => o.label === v)?.points ?? 0;
  }
  return score;
}

/** The outcome with the highest threshold the score reaches. */
export function pickOutcome(def: SurveyDef, score: number): Outcome | null {
  return [...(def.outcomes ?? [])].sort((a, b) => b.minScore - a.minScore).find((o) => score >= o.minScore) ?? null;
}

/** Finds a block anywhere in a Puck page, including nested slots. */
export function findBlock(data: unknown, id: string): { type: string; props: Record<string, unknown> } | null {
  const seen = new Set<unknown>();
  const walk = (node: unknown): { type: string; props: Record<string, unknown> } | null => {
    if (!node || typeof node !== "object" || seen.has(node)) return null;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const n of node) {
        const r = walk(n);
        if (r) return r;
      }
      return null;
    }
    const o = node as { type?: unknown; props?: Record<string, unknown> };
    if (typeof o.type === "string" && o.props && o.props.id === id) return { type: o.type, props: o.props };
    for (const v of Object.values(o)) {
      const r = walk(v);
      if (r) return r;
    }
    return null;
  };
  return walk(data);
}
