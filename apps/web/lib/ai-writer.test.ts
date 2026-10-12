import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const admin = vi.fn();
const complete = vi.fn();
const getWs = vi.fn();
vi.mock("./admin", () => ({ currentAdmin: () => admin() }));
vi.mock("./session", () => ({ requireUser: async () => ({ id: "u1", email: "a@b.co" }) }));
vi.mock("./i18n", () => ({ getT: async () => (k: string) => k }));
vi.mock("./workspaces", () => ({ getWorkspaceForUser: (...a: unknown[]) => getWs(...a) }));
vi.mock("./ai", () => ({
  aiConfigured: () => true,
  complete: (...a: unknown[]) => complete(...a),
  takeAiQuota: vi.fn(() => true),
}));
vi.mock("@zfunnel/email", () => ({ sanitizeRichText: (s: string) => s }));

const { aiWrite } = await import("./ai-writer-actions");
const { cleanWriterOutput, isCopyField, writerPrompt, writerSystem } = await import("./ai-writer");

describe("AI writer guard (platform admins only)", () => {
  beforeEach(() => {
    admin.mockReset();
    complete.mockReset();
    getWs.mockReset();
    getWs.mockResolvedValue({ workspace: { id: "w1", siteLocale: "ar" }, membership: {} });
    complete.mockResolvedValue("عنوان جديد");
  });

  it("refuses non-admins without calling the AI", async () => {
    admin.mockResolvedValue(null);
    const r = await aiWrite("ws", { action: "rewrite", format: "plain", text: "Hello" });
    expect(r).toEqual({ ok: false, error: "aiWriter.adminOnly" });
    expect(complete).not.toHaveBeenCalled();
    expect(getWs).not.toHaveBeenCalled();
  });

  it("lets admins write, in the site's language", async () => {
    admin.mockResolvedValue({ id: "u1" });
    const r = await aiWrite("ws", { action: "shorten", format: "plain", text: "Hello there" });
    expect(r).toEqual({ ok: true, text: "عنوان جديد" });
    const call = complete.mock.calls[0]![0] as { system: string; prompt: string };
    expect(call.system).toContain("natively");
    expect(call.prompt).toContain("Site language: Arabic");
  });

  it("validates the input", async () => {
    admin.mockResolvedValue({ id: "u1" });
    const r = await aiWrite("ws", { action: "nope" as never, format: "plain", text: "x" });
    expect(r).toEqual({ ok: false, error: "ai.invalidRequest" });
  });
});

describe("AI writer prompts", () => {
  it("asks for native Arabic, not a translation", () => {
    expect(writerSystem("ar")).toMatch(/Never translate/);
    expect(writerSystem("en")).toMatch(/Write in English/);
  });
  it("describes each action", () => {
    const p = writerPrompt({ action: "grammar", format: "html", text: "<p>hi</p>", lang: "en", field: "Text" });
    expect(p).toContain("Fix spelling");
    expect(p).toContain("simple HTML");
  });
  it("cleans the model's output", () => {
    expect(cleanWriterOutput('```\n"Buy now"\nextra```', "plain", false)).toBe("Buy now");
    expect(cleanWriterOutput("«اشترِ الآن»", "plain", false)).toBe("اشترِ الآن");
    expect(cleanWriterOutput("a\nb", "plain", true)).toBe("a\nb");
  });
  it("only offers the writer on copy fields", () => {
    expect(isCopyField("text")).toBe(true);
    expect(isCopyField("items[0].answer")).toBe(true);
    expect(isCopyField("buttonLabel")).toBe(true);
    expect(isCopyField("imageUrl")).toBe(false);
    expect(isCopyField("href")).toBe(false);
    expect(isCopyField("tag")).toBe(false);
    expect(isCopyField("width")).toBe(false);
  });
});
