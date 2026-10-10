import { describe, expect, it } from "vitest";
import { config } from "./config";
import { buildTemplate, TEMPLATES } from "./templates";

function walk(nodes: { type: string; props: Record<string, unknown> }[], seen: string[]) {
  for (const n of nodes) {
    seen.push(n.type);
    for (const v of Object.values(n.props)) if (Array.isArray(v) && v[0]?.type && v[0]?.props) walk(v as never, seen);
  }
}

describe("templates", () => {
  it("has 11 templates with unique ids", () => {
    expect(TEMPLATES).toHaveLength(11);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });
  it.each(TEMPLATES.map((t) => t.id))("%s builds valid pages using only known blocks", (id) => {
    const steps = buildTemplate(id)!;
    expect(steps.length).toBeGreaterThan(1);
    for (const s of steps) {
      const types: string[] = [];
      walk(s.page.content as never, types);
      expect(types.length).toBeGreaterThan(0);
      for (const t of types) expect(config.components).toHaveProperty(t);
      const ids = JSON.stringify(s.page).match(/"id":"[^"]+"/g) ?? [];
      expect(new Set(ids).size).toBe(ids.length); // block ids must be unique
    }
  });
  it("applies each template's preset colours", () => {
    const tripwire = buildTemplate("tripwire")![0]!.page.root.props as { primary: string };
    expect(tripwire.primary).toBe("#ea580c");
  });
  it("checkout steps contain an order form", () => {
    for (const t of TEMPLATES)
      for (const s of buildTemplate(t.id)!)
        if (s.type === "checkout") expect(JSON.stringify(s.page)).toContain('"type":"OrderForm"');
  });
});

describe("Arabic templates", () => {
  // Text props that hold copy (not ids, enum values, URLs, prices or tags).
  const COPY = new Set([
    "text",
    "label",
    "sublabel",
    "buttonLabel",
    "privacyNote",
    "successMessage",
    "title",
    "question",
    "answer",
    "quote",
    "name",
    "role",
    "description",
    "features",
    "cta",
    "expiredText",
    "contactTitle",
    "paymentTitle",
    "guarantee",
    "acceptLabel",
    "acceptSublabel",
    "declineLabel",
    "formName",
    "alt",
    "highlight",
    "options",
  ]);
  const copyOf = (v: unknown, key = "", out: string[] = []): string[] => {
    if (typeof v === "string") {
      if (COPY.has(key)) out.push(v);
    } else if (Array.isArray(v)) v.forEach((x) => copyOf(x, key, out));
    else if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) copyOf(x, k === "props" ? key : k, out);
    return out;
  };

  it.each(TEMPLATES.map((t) => t.id))("%s exists in Arabic with the same steps and no English copy", (id) => {
    const en = buildTemplate(id)!;
    const ar = buildTemplate(id, "ar")!;
    expect(ar.map((s) => s.type)).toEqual(en.map((s) => s.type));
    for (const s of ar) {
      const english = copyOf(s.page.content).filter((v) => /[A-Za-z]{3,}/.test(v.replace(/<\/?(p|strong)>/g, "")));
      expect(english, `${id} / ${s.name}`).toEqual([]);
      expect(/[؀-ۿ]/.test(s.name)).toBe(true);
    }
  });

  it("does not leak the Arabic build language into later English builds", () => {
    buildTemplate("quiz", "ar");
    const en = JSON.stringify(buildTemplate("lead-magnet"));
    expect(/[؀-ۿ]/.test(en)).toBe(false);
  });
});
