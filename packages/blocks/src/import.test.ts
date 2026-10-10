import type { ComponentData } from "@puckeditor/core";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { convertHtml, rewriteImages, sanitizeFragment, toHex } from "./import";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");
const URL_ = "https://acme.myclickfunnels.com/optin-page";

/** Flattens the block tree (sections, columns) into a list. */
function flat(nodes: ComponentData[]): ComponentData[] {
  return nodes.flatMap((n) => [
    n,
    ...Object.values(n.props).flatMap((v) =>
      Array.isArray(v) && (v[0] as ComponentData | undefined)?.type ? flat(v as ComponentData[]) : [],
    ),
  ]);
}
const ofType = (nodes: ComponentData[], type: string) => flat(nodes).filter((n) => n.type === type);

describe("convertHtml: classic ClickFunnels opt-in page", () => {
  const r = convertHtml(fixture("cf-classic-optin.html"), URL_);
  const all = r.page.content;

  it("detects classic markup, the title and an opt-in step", () => {
    expect(r.source).toBe("classic");
    expect(r.title).toBe("Free Guide: 7 Funnel Secrets");
    expect(r.stepType).toBe("optin");
  });

  it("turns each .container section into a Section with its background colour", () => {
    expect(all.map((n) => n.type)).toEqual(["Section", "Section", "Section"]);
    expect(all[0]!.props).toMatchObject({ background: "custom", customColor: "#111827" });
    expect(all[1]!.props).toMatchObject({ background: "custom", customColor: "#f3f4f6" });
  });

  it("maps headlines, video, columns, image and bullets", () => {
    const [h1, h2] = ofType(all, "Heading");
    expect(h1!.props).toMatchObject({
      text: "Get The 7 Funnel Secrets Top Marketers Use",
      level: "h1",
      align: "center",
    });
    expect(h2!.props).toMatchObject({ text: "Download the free guide & double your leads", level: "h2" });
    expect(ofType(all, "Video")[0]!.props.url).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const cols = ofType(all, "Columns")[0]!;
    expect(cols.props.count).toBe("2");
    expect(ofType(cols.props.c1 as ComponentData[], "Image")[0]!.props).toMatchObject({
      src: "https://images.clickfunnels.com/ab/cd/guide-cover.png",
      alt: "Guide cover",
    });
    expect(ofType(all, "Checklist")[0]!.props.items).toEqual([
      { text: "The headline formula that converts" },
      { text: "Why short pages win" },
      { text: "The follow-up sequence" },
    ]);
  });

  it("assembles loose CF inputs and the #submit-form button into one opt-in form", () => {
    const forms = ofType(all, "OptInForm");
    expect(forms).toHaveLength(1);
    expect(forms[0]!.props).toMatchObject({ askName: true, askPhone: false, buttonLabel: "Send Me The Guide" });
    expect(ofType(all, "Button")).toHaveLength(0);
  });

  it("maps the countdown to a fixed date", () => {
    const c = ofType(all, "Countdown")[0]!;
    expect(c.props.mode).toBe("date");
    expect(String(c.props.date)).toMatch(/^2030-12-3[01]T/);
  });

  it("keeps unmappable markup as sanitized custom HTML with no scripts or handlers", () => {
    const html = ofType(all, "CustomHtml").map((n) => String(n.props.html));
    expect(html).toHaveLength(1);
    expect(html[0]).toContain("<table>");
    expect(html[0]).toContain("Plan A");
    const json = JSON.stringify(r.page);
    expect(json).not.toMatch(/<script|onmouseover|onclick|onload|javascript:|evil\.example/i);
  });

  it("drops tracking pixels and lists the images to re-host", () => {
    expect(JSON.stringify(r.page)).not.toMatch(/facebook\.com\/tr|linkedin/);
    expect(r.images).toEqual([
      "https://images.clickfunnels.com/ab/cd/guide-cover.png",
      "https://cdn.example.com/badge.png",
    ]);
  });

  it("keeps safe links in rich text", () => {
    const texts = ofType(all, "Text").map((n) => String(n.props.text));
    expect(texts.some((t) => t.includes('<a href="mailto:help@example.com">Email us</a>'))).toBe(true);
  });
});

describe("convertHtml: ClickFunnels 2.0 sales page", () => {
  const r = convertHtml(fixture("cf2-sales.html"), URL_);
  const all = r.page.content;

  it("detects CF 2.0 markup and a sales step", () => {
    expect(r.source).toBe("cf2");
    expect(r.stepType).toBe("sales");
  });

  it("maps rows of ColContainers into columns and lazy images to absolute URLs", () => {
    const cols = ofType(all, "Columns")[0]!;
    expect(ofType(cols.props.c1 as ComponentData[], "Heading")[0]!.props).toMatchObject({
      text: "Master Funnels In 30 Days",
      align: "left",
    });
    expect(ofType(cols.props.c2 as ComponentData[], "Image")[0]!.props.src).toBe(
      "https://acme.myclickfunnels.com/hero.jpg",
    );
  });

  it("maps buttons with main and sub text, links and anchors", () => {
    const [enroll, faq] = ofType(all, "Button");
    expect(enroll!.props).toMatchObject({
      label: "Enroll Now",
      sublabel: "Lifetime access",
      action: "url",
      url: "https://shop.example.com/checkout?ref=cf",
      newTab: true,
    });
    expect(faq!.props).toMatchObject({ label: "Read the FAQ", action: "anchor", anchor: "faq" });
  });

  it("maps Vimeo and Wistia videos, bullets, countdown and background images", () => {
    expect(ofType(all, "Video").map((v) => v.props.url)).toEqual([
      "https://vimeo.com/76979871",
      "https://fast.wistia.net/embed/iframe/abc123xyz",
    ]);
    expect(ofType(all, "Checklist")[0]!.props.items).toHaveLength(2);
    expect(ofType(all, "Countdown")[0]!.props).toMatchObject({ mode: "date", date: "2031-01-15T10:00" });
    expect(all[1]!.props).toMatchObject({ background: "image", imageUrl: "https://cdn.example.com/bg.jpg" });
    expect(r.images).toContain("https://cdn.example.com/bg.jpg");
  });

  it("keeps rich text formatting", () => {
    expect(ofType(all, "Text")[0]!.props.text).toBe(
      "<p>Join <strong>4,000+ students</strong> who doubled their sales.</p>",
    );
  });
});

describe("convertHtml: checkout and generic pages", () => {
  it("turns a CF order form into the order form block and a checkout step", () => {
    const r = convertHtml(fixture("cf2-checkout.html"), URL_);
    expect(r.stepType).toBe("checkout");
    expect(ofType(r.page.content, "OrderForm")).toHaveLength(1);
    expect(ofType(r.page.content, "OptInForm")).toHaveLength(0);
  });

  it("handles plain HTML: sections, flex columns, forms, tables and unknown iframes", () => {
    const r = convertHtml(fixture("generic.html"), "https://example.com/thanks");
    expect(r.source).toBe("generic");
    const all = r.page.content;
    expect(all[0]!.props).toMatchObject({ background: "custom", customColor: "#fef3c7" });
    expect(ofType(all, "Columns")).toHaveLength(1);
    expect(ofType(all, "OptInForm")[0]!.props).toMatchObject({ askPhone: true, buttonLabel: "Join the list" });
    // The non-video iframe is not allowed through and leaves nothing behind.
    expect(ofType(all, "CustomHtml").map((n) => n.props.html)).toEqual([expect.stringContaining("Agenda")]);
    expect(ofType(all, "Button")[0]!.props).toMatchObject({ label: "Add to calendar", action: "next" });
  });

  it("survives empty and broken input", () => {
    expect(convertHtml("", URL_).page.content).toEqual([]);
    const r = convertHtml("<div><p>Hello <b>world", URL_);
    expect(ofType(r.page.content, "Text")[0]!.props.text).toBe("<p>Hello <b>world</b></p>");
  });
});

describe("helpers", () => {
  it("normalises colours", () => {
    expect(toHex("#FFF")).toBe("#ffffff");
    expect(toHex("rgb(17, 24, 39)")).toBe("#111827");
    expect(toHex("rgba(0,0,0,0)")).toBe("");
    expect(toHex("transparent")).toBe("");
  });

  it("strips dangerous markup from custom HTML", () => {
    const out = sanitizeFragment(
      `<div onclick="x()"><script>bad()</script><iframe src="https://evil.example/"></iframe>
       <iframe src="https://player.vimeo.com/video/1"></iframe><form action="https://phish.example"><input name="pw"></form>
       <a href="javascript:alert(1)">x</a><img src="https://www.facebook.com/tr?id=1"><style>body{}</style></div>`,
      "https://a.example/",
    );
    expect(out).not.toMatch(/script|onclick|evil|phish|<form|<input|javascript|facebook|<style/);
    expect(out).toContain("player.vimeo.com");
  });

  it("rewrites image URLs in props and custom HTML", () => {
    const r = convertHtml(
      `<section><img src="https://x.example/a.png?w=1&h=2"><table><tr><td><img src="https://x.example/a.png?w=1&h=2"></td></tr></table></section>`,
      URL_,
    );
    const out = rewriteImages(r.page, new Map([["https://x.example/a.png?w=1&h=2", "https://site/api/media/1"]]));
    const json = JSON.stringify(out);
    expect(json).not.toContain("x.example");
    expect(json.match(/api\/media\/1/g)).toHaveLength(2);
  });
});
