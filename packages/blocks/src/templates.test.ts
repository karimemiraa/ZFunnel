import { describe, expect, it } from "vitest";
import { config } from "./config";
import { buildTemplate, TEMPLATES } from "./templates";

function walk(nodes: { type: string; props: Record<string, unknown> }[], seen: string[]) {
  for (const n of nodes) {
    seen.push(n.type);
    for (const v of Object.values(n.props)) if (Array.isArray(v) && v[0]?.type) walk(v as never, seen);
  }
}

describe("templates", () => {
  it("has 10 templates with unique ids", () => {
    expect(TEMPLATES).toHaveLength(10);
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(10);
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
