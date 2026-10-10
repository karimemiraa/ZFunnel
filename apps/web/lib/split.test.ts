import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./funnels", () => ({ inWorkspace: vi.fn() }));
const { confidence } = await import("./split");

const s = (visitors: number, converted: number) => ({ key: "x", visitors, converted, rate: converted / visitors });

describe("confidence", () => {
  it("needs enough traffic", () => {
    expect(confidence(s(10, 1), s(10, 5))).toBeNull();
  });
  it("is high for a clear winner and low for noise", () => {
    expect(confidence(s(1000, 100), s(1000, 150))!).toBeGreaterThan(0.99);
    expect(confidence(s(1000, 100), s(1000, 102))!).toBeLessThan(0.5);
  });
});
