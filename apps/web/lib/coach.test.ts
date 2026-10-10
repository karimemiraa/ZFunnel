import { describe, expect, it } from "vitest";
import { coachPrompt, parseCoach } from "./coach";

describe("conversion coach", () => {
  it("puts numbers and trimmed plain copy in the prompt", () => {
    const p = coachPrompt({
      funnelName: "Webinar",
      days: 30,
      currency: "usd",
      steps: [
        {
          name: "Opt-in",
          type: "optin",
          visitors: 400,
          conversions: 40,
          rate: 0.1,
          tracked: true,
          revenue: 0,
          copy: ["<h1>Free <b>class</b></h1>", "x".repeat(3000)],
        },
      ],
    });
    expect(p).toContain('"Opt-in" (optin): 400 unique visitors, 40 conversions (10.0%)');
    expect(p).toContain("Free class");
    expect(p).not.toContain("<b>");
    expect(p.length).toBeLessThan(2000);
  });

  it("keeps known steps, strips HTML and caps the list", () => {
    const raw =
      "Here you go:\n```json\n" +
      JSON.stringify({
        summary: "<b>Opt-in</b> is weak.",
        suggestions: [
          {
            title: "Rewrite headline",
            step: "opt-in",
            why: "10%",
            change: "<script>x</script>Lead with the outcome",
            impact: "high",
          },
          { title: "Add proof", step: "Unknown step", why: "", change: "Add a testimonial section", impact: "huge" },
          { title: "", change: "dropped" },
          ...Array.from({ length: 8 }, (_, i) => ({ title: `T${i}`, change: "c" })),
        ],
      }) +
      "\n```";
    const r = parseCoach(raw, ["Opt-in", "Thank you"])!;
    expect(r.summary).toBe("Opt-in is weak.");
    expect(r.suggestions[0]).toEqual({
      title: "Rewrite headline",
      step: "Opt-in",
      why: "10%",
      change: "xLead with the outcome",
      impact: "high",
    });
    expect(r.suggestions[1]).toMatchObject({ step: null, impact: "medium" });
    expect(r.suggestions.length).toBeLessThanOrEqual(6);
  });

  it("rejects unusable answers", () => {
    expect(parseCoach("sorry", ["A"])).toBeNull();
    expect(parseCoach('{"summary":"ok","suggestions":[]}', ["A"])).toBeNull();
  });
});
