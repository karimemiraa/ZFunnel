import { describe, expect, it } from "vitest";
import { findBlock, parseOptions, pickOutcome, scoreAnswers, validateAnswers, type SurveyDef } from "./survey";

const def: SurveyDef = {
  formName: "Fit quiz",
  askEmail: true,
  tag: "",
  quiz: true,
  questions: [
    {
      label: "Goal",
      type: "single_choice",
      required: true,
      options: "Lose weight | 2\nBuild muscle | 5",
      saveTo: "goal",
    },
    { label: "Days", type: "multiple_choice", required: false, options: "Mon | 1\nWed | 1\nFri | 1", saveTo: "" },
    { label: "Notes", type: "long_text", required: false, options: "", saveTo: "" },
  ],
  outcomes: [
    { minScore: 0, title: "Beginner", tag: "beginner", redirect: "" },
    { minScore: 6, title: "Advanced", tag: "advanced", redirect: "https://example.com/pro" },
  ],
};

describe("survey", () => {
  it("parses options with optional points", () => {
    expect(parseOptions("A | 3\nB\n\n C|-1 ")).toEqual([
      { label: "A", points: 3 },
      { label: "B", points: 0 },
      { label: "C", points: -1 },
    ]);
  });

  it("validates, drops unknown choices and scores server-side", () => {
    const r = validateAnswers(def, { q1: "Build muscle", q2: ["Mon", "Fri", "Hacked"], q3: "  " });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.answers).toHaveLength(2);
    expect(r.answers[1]!.value).toEqual(["Mon", "Fri"]);
    const score = scoreAnswers(def, r.answers);
    expect(score).toBe(7);
    expect(pickOutcome(def, score)?.title).toBe("Advanced");
    expect(pickOutcome(def, 3)?.title).toBe("Beginner");
  });

  it("rejects missing required answers and forged options", () => {
    expect(validateAnswers(def, {})).toMatchObject({ ok: false });
    expect(validateAnswers(def, { q1: "Free money" })).toMatchObject({ ok: false });
  });

  it("finds blocks nested in slots", () => {
    const page = {
      root: {},
      content: [{ type: "Section", props: { id: "s1", content: [{ type: "Survey", props: { id: "x" } }] } }],
    };
    expect(findBlock(page, "x")?.type).toBe("Survey");
    expect(findBlock(page, "nope")).toBeNull();
  });
});
