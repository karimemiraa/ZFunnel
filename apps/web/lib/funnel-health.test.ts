import { describe, expect, it } from "vitest";
import {
  applySeoFix,
  blocksOf,
  checkFunnel,
  healthScore,
  nextStepFor,
  scoreBand,
  seoSuggestion,
  type HealthInput,
  type HealthStep,
  type PageLike,
} from "./funnel-health";

const b = (type: string, props: Record<string, unknown> = {}) => ({ type, props });
const section = (content: ReturnType<typeof b>[], props: Record<string, unknown> = {}) =>
  b("Section", { ...props, content });
const goodRoot = { title: "Free guide", seoDescription: "Get the guide", ogImage: "https://x.co/og.png" };
const pageOf = (content: ReturnType<typeof b>[], root: Record<string, unknown> = goodRoot): PageLike => ({
  root: { props: root },
  content,
});

function step(over: Partial<HealthStep> & { id: string }): HealthStep {
  return {
    name: over.id,
    slug: over.id,
    type: "page",
    nextStepId: null,
    declineStepId: null,
    published: true,
    changed: false,
    page: pageOf([section([b("Heading", { text: "Hi" })])]),
    offers: { main: 0, upsell: 0 },
    ...over,
  };
}
const input = (steps: HealthStep[], over: Partial<HealthInput> = {}): HealthInput => ({
  funnelSlug: "f",
  steps,
  hasFavicon: true,
  hasDomain: true,
  hasFormAutomation: true,
  ...over,
});
const rules = (i: HealthInput) => checkFunnel(i).map((x) => x.rule);

describe("funnel health", () => {
  it("is clean for a healthy funnel", () => {
    const issues = checkFunnel(
      input([
        step({ id: "a", type: "optin", nextStepId: "b", page: pageOf([section([b("OptInForm")])]) }),
        step({ id: "b", type: "thankyou" }),
      ]),
    );
    expect(issues).toEqual([]);
    expect(healthScore(issues)).toBe(100);
    expect(scoreBand(100)).toBe("good");
  });

  it("walks blocks inside sections and columns", () => {
    const p = pageOf([section([b("Columns", { c1: [b("Button")], c2: [b("Image")] })])]);
    expect(blocksOf(p).map((x) => x.type)).toEqual(["Section", "Columns", "Button", "Image"]);
  });

  it("flags buttons that go next with no next step, with a one-click link fix", () => {
    const steps = [
      step({ id: "a", page: pageOf([section([b("Button", { action: "next", label: "Go" })])]) }),
      step({ id: "b" }),
    ];
    const [issue] = checkFunnel(input(steps)).filter((i) => i.rule === "nextMissing");
    expect(issue).toMatchObject({ severity: "critical", stepId: "a", fix: "linkNext" });
    expect(nextStepFor(steps, "a")).toBe("b");
    expect(nextStepFor(steps, "b")).toBeNull();
  });

  it("flags a next step that no longer exists", () => {
    expect(rules(input([step({ id: "a", nextStepId: "gone" })]))).toContain("nextBroken");
  });

  it("flags empty URLs, broken internal links and missing anchors", () => {
    const r = rules(
      input([
        step({
          id: "a",
          nextStepId: "b",
          page: pageOf([
            section([b("Heading", { text: "x" })], { anchor: "pricing" }),
            b("Button", { action: "url", url: "", label: "Buy" }),
            b("Button", { action: "url", url: "/f/missing", label: "Old" }),
            b("Button", { action: "url", url: "/f/b?x=1", label: "Ok" }),
            b("Button", { action: "anchor", anchor: "#pricing" }),
            b("Button", { action: "anchor", anchor: "faq" }),
          ]),
        }),
        step({ id: "b" }),
      ]),
    );
    expect(r.filter((x) => x === "buttonUrlEmpty")).toHaveLength(1);
    expect(r.filter((x) => x === "internalLinkBroken")).toHaveLength(1);
    expect(r.filter((x) => x === "anchorBroken")).toHaveLength(1);
  });

  it("checks SEO on landing pages only and offers a fix from the content", () => {
    const content = [
      section([
        b("Heading", { text: "<strong>Grow</strong> your list" }),
        b("Text", { text: "<p>A practical guide to growing your email list fast.</p>" }),
        b("Image", { src: "https://x.co/a.png", alt: "Cover" }),
      ]),
    ];
    const issues = checkFunnel(
      input([
        step({ id: "a", type: "optin", nextStepId: "b", page: pageOf(content, {}) }),
        step({ id: "b", type: "checkout", nextStepId: "c", page: pageOf(content, {}), offers: { main: 1, upsell: 0 } }),
        step({ id: "c", type: "thankyou" }),
      ]),
    );
    const seo = issues.filter((i) => ["seoTitle", "seoDescription", "ogImage"].includes(i.rule));
    expect(seo.map((i) => i.stepId)).toEqual(["a", "a", "a"]);
    expect(seo.every((i) => i.fix === "seoFromContent")).toBe(true);
    expect(seoSuggestion(pageOf(content))).toEqual({
      title: "Grow your list",
      seoDescription: "A practical guide to growing your email list fast.",
      ogImage: "https://x.co/a.png",
    });
  });

  it("applies the SEO fix only to empty fields", () => {
    const p = pageOf(
      [b("Heading", { text: "Title from heading" }), b("Text", { text: "<p>Twenty characters or more here.</p>" })],
      { title: "Keep me", seoDescription: "" },
    );
    const fixed = applySeoFix(p)!;
    expect(fixed.root!.props!.title).toBe("Keep me");
    expect(fixed.root!.props!.seoDescription).toBe("Twenty characters or more here.");
    expect(applySeoFix(pageOf([], {}))).toBeNull();
    expect(applySeoFix(pageOf([b("Heading", { text: "New" })], {}))!.root!.props!.title).toBe("New");
  });

  it("flags checkouts and upsells without products, and the missing decline path", () => {
    const r = rules(
      input([
        step({ id: "a", type: "checkout", nextStepId: "b" }),
        step({ id: "b", type: "upsell", nextStepId: "c" }),
        step({ id: "c", type: "thankyou" }),
      ]),
    );
    expect(r).toEqual(expect.arrayContaining(["checkoutNoProduct", "upsellNoOffer", "declineMissing"]));
  });

  it("flags unpublished steps and unpublished changes with a publish fix", () => {
    const issues = checkFunnel(
      input([step({ id: "a", published: false, nextStepId: "b" }), step({ id: "b", changed: true })]),
    );
    expect(issues.find((i) => i.rule === "unpublished")).toMatchObject({ severity: "warning", fix: "publish" });
    expect(issues.find((i) => i.rule === "unpublishedChanges")).toMatchObject({ severity: "info", fix: "publish" });
  });

  it("flags oversized uploaded images (where the size is known) and missing alt text", () => {
    const id = "11111111-2222-3333-4444-555555555555";
    const r = checkFunnel(
      input([step({ id: "a", page: pageOf([b("Image", { src: `/api/media/${id}`, alt: "" })]) })], {
        imageBytes: { [id]: 900 * 1024 },
      }),
    );
    expect(r.find((i) => i.rule === "imageOversized")?.params).toEqual({ kb: 900 });
    expect(r.some((i) => i.rule === "imageNoAlt")).toBe(true);
  });

  it("flags site-wide gaps: favicon, domain, forms without automation", () => {
    const r = rules(
      input([step({ id: "a", page: pageOf([b("Survey")]) })], {
        hasFavicon: false,
        hasDomain: false,
        hasFormAutomation: false,
      }),
    );
    expect(r).toEqual(expect.arrayContaining(["noFavicon", "noDomain", "formNoAutomation"]));
  });

  it("flags fixed widths that overflow phones", () => {
    const r = checkFunnel(
      input([
        step({
          id: "a",
          page: pageOf([
            b("CustomHtml", { html: '<div style="width: 900px">x</div><iframe width="320"></iframe>' }),
            b("CustomHtml", { html: '<img width="100%">' }),
          ]),
        }),
      ]),
    );
    expect(r.filter((i) => i.rule === "mobileFixedWidth").map((i) => i.params)).toEqual([{ px: 900 }]);
  });

  it("sorts by severity and caps repeated rules in the score", () => {
    const steps = Array.from({ length: 10 }, (_, i) => step({ id: `s${i}`, published: false }));
    const issues = checkFunnel(input(steps));
    expect(issues[0]!.severity).toBe("warning");
    expect(healthScore(issues)).toBe(100 - 3 * 6);
    expect(scoreBand(50)).toBe("poor");
  });
});
