import { describe, expect, it } from "vitest";
import { emailRichText, htmlToText, safeHref } from "./html";
import { personalize, renderEmail, type EmailDoc } from "./render";
import { signToken, verifyToken } from "./tokens";

process.env.BETTER_AUTH_SECRET = "test-secret";
const footer = { fromName: "Acme", postalAddress: "1 Main St, Berlin", unsubscribeUrl: "https://app.x/e/u/t" };
const doc: EmailDoc = {
  root: { props: { brand: "#ff0000" } },
  content: [
    { type: "Heading", props: { text: "Hi {{first_name|there}}!", size: "lg", align: "left" } },
    {
      type: "Text",
      props: {
        text: '<p>Visit <a href="https://acme.com/x?a=1&b=2">our site</a></p><script>alert(1)</script>',
        align: "left",
      },
    },
    { type: "Button", props: { label: "Buy now", url: "https://acme.com/buy", align: "center", fullWidth: false } },
  ],
};

describe("email rendering", () => {
  it("personalizes with fallbacks and escapes values", () => {
    expect(personalize("Hi {{first_name|friend}}", {})).toBe("Hi friend");
    expect(personalize("Hi {{first_name}}", { first_name: "<b>Eve</b>" })).toBe("Hi &lt;b&gt;Eve&lt;/b&gt;");
  });
  it("renders a full document with footer, preheader and no scripts", () => {
    const { html, text } = renderEmail(doc, { footer, preheader: "Big news", vars: { first_name: "Anna" } });
    expect(html).toContain("Hi Anna!");
    expect(html).toContain("1 Main St, Berlin");
    expect(html).toContain("Unsubscribe");
    expect(html).toContain("Big news");
    expect(html).not.toContain("<script");
    expect(html).toContain("#ff0000");
    expect(text).toContain("our site (https://acme.com/x?a=1&b=2)");
  });
  it("rewrites links for click tracking but keeps the footer unsubscribe link", () => {
    const { html } = renderEmail(doc, { footer, rewriteLink: (u) => `https://t.x/c?u=${encodeURIComponent(u)}` });
    expect(html).toContain(`https://t.x/c?u=${encodeURIComponent("https://acme.com/x?a=1&b=2")}`);
    expect(html).toContain('href="https://app.x/e/u/t"');
  });
  it("sanitizes rich text and unsafe links", () => {
    expect(safeHref("javascript:alert(1)")).toBe("#");
    expect(
      emailRichText('<p onclick="x">Hi <img src=x onerror=alert(1)></p>', {
        text: "#000",
        link: "#00f",
        font: "Arial",
      }),
    ).not.toMatch(/onclick|onerror|<img/);
    expect(htmlToText("<p>A</p><ul><li>x</li></ul>")).toBe("A\n• x");
  });
  it("signs and verifies tracking tokens", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const t = signToken("u", id);
    expect(verifyToken("u", t)).toBe(id);
    expect(verifyToken("o", t)).toBeNull();
    expect(verifyToken("u", t.slice(0, -2) + "xx")).toBeNull();
  });
});
