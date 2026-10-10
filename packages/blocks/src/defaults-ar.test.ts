import { describe, expect, it } from "vitest";
import { config, configFor } from "./config";
import { AR_DEFAULTS } from "./defaults-ar";

describe("Arabic block defaults", () => {
  it("only override props that exist, with the same shape", () => {
    for (const [name, props] of Object.entries(AR_DEFAULTS)) {
      const base = (config.components as Record<string, { defaultProps?: Record<string, unknown> }>)[name];
      expect(base, name).toBeDefined();
      for (const [k, v] of Object.entries(props)) {
        const en = base!.defaultProps?.[k];
        expect(en, `${name}.${k}`).toBeDefined();
        expect(Array.isArray(v), `${name}.${k}`).toBe(Array.isArray(en));
        if (Array.isArray(v) && Array.isArray(en)) expect(v.length, `${name}.${k}`).toBe(en.length);
      }
    }
  });
  it("leaves English untouched and contains no Latin words in Arabic copy", () => {
    expect(configFor("en")).toBe(config);
    const ar = configFor("ar").components.OptInForm.defaultProps;
    expect(ar?.buttonLabel).toBe("أرسلوا لي الدليل المجاني");
    // Every text value (not keys, icons, enum values or prices) must be Arabic.
    const values: string[] = [];
    const walk = (v: unknown, key = ""): void => {
      if (typeof v === "string" && !["icon", "type", "saveTo", "avatar", "price", "value"].includes(key))
        values.push(v);
      else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
      else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => walk(x, k));
    };
    walk(AR_DEFAULTS);
    expect(values.filter((v) => /[A-Za-z]{3,}/.test(v.replace(/<\/?p>/g, "")))).toEqual([]);
  });
});
