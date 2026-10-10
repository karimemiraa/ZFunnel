import type { Config } from "@puckeditor/core";
import type * as React from "react";
import { BLOCK_HTML, DEFAULT_EMAIL_THEME, EMAIL_FONTS, type Ctx, type EmailTheme } from "./blocks";
import type { EmailDoc } from "./render";

/**
 * Puck config for the email editor. Every block previews the exact HTML that is sent
 * (BLOCK_HTML), so what you see is what lands in the inbox.
 */
const align = {
  type: "radio" as const,
  label: "Alignment",
  options: [
    { label: "Left", value: "left" },
    { label: "Center", value: "center" },
    { label: "Right", value: "right" },
  ],
};
const color = (label: string) => ({ type: "text" as const, label: `${label} (hex)` });

function ctxFrom(metadata: unknown): Ctx {
  const theme = { ...DEFAULT_EMAIL_THEME, ...((metadata as { theme?: Partial<EmailTheme> })?.theme ?? {}) };
  return { theme, font: EMAIL_FONTS[theme.font]?.stack ?? EMAIL_FONTS.system.stack };
}
const Rows = ({ html }: { html: string }) => (
  <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
    <tbody dangerouslySetInnerHTML={{ __html: html }} />
  </table>
);

export const emailConfig: Config = {
  root: {
    fields: {
      brand: color("Brand color"),
      background: color("Background"),
      card: color("Card"),
      text: color("Text color"),
      font: {
        type: "select",
        label: "Font",
        options: Object.entries(EMAIL_FONTS).map(([value, f]) => ({ value, label: f.label })),
      },
    },
    defaultProps: { ...DEFAULT_EMAIL_THEME },
    render: (({ children, brand, background, card, text, font }: { children: React.ReactNode } & EmailTheme) => (
      <div style={{ background, padding: "32px 12px", minHeight: "100%" }}>
        <div
          style={{
            maxWidth: 600,
            margin: "0 auto",
            background: card,
            borderRadius: 14,
            padding: "24px 0 16px",
            color: text,
            fontFamily: EMAIL_FONTS[font as keyof typeof EMAIL_FONTS]?.stack,
            ["--brand" as string]: brand,
          }}
        >
          {children}
        </div>
        <p style={{ textAlign: "center", fontFamily: "Arial", fontSize: 12, color: "#8a8f9c", margin: "20px 0 0" }}>
          Your footer with postal address and unsubscribe link is added automatically.
        </p>
      </div>
    )) as never,
  },
  categories: {
    content: { title: "Content", components: ["Logo", "Heading", "Text", "Button", "Image", "Divider", "Spacer"] },
  },
  components: {
    Logo: {
      fields: {
        src: { type: "text", label: "Logo URL" },
        width: { type: "number", label: "Width (px)", min: 40, max: 400 },
        align,
      },
      defaultProps: { src: "", width: 120, align: "center" },
      render: ({ puck: _puck, ...p }) =>
        p.src ? (
          <Rows html={BLOCK_HTML.Logo(p as never)} />
        ) : (
          <div style={{ padding: "16px 40px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            Logo (add an image URL)
          </div>
        ),
    },
    Heading: {
      fields: {
        text: { type: "textarea", label: "Text", contentEditable: true },
        size: {
          type: "radio",
          label: "Size",
          options: [
            { label: "L", value: "lg" },
            { label: "M", value: "md" },
            { label: "S", value: "sm" },
          ],
        },
        align,
      },
      defaultProps: { text: "Hi {{first_name|there}} 👋", size: "lg", align: "left" },
      render: ({ puck, text, ...p }) => {
        const c = ctxFrom(puck.metadata);
        if (typeof text !== "string")
          return (
            <div
              style={{
                padding: "8px 40px 16px",
                textAlign: p.align,
                fontFamily: c.font,
                fontSize: { lg: 30, md: 24, sm: 19 }[p.size as "lg"],
                fontWeight: 700,
                lineHeight: 1.25,
              }}
            >
              {text}
            </div>
          );
        return <Rows html={BLOCK_HTML.Heading({ text, ...p } as never, c)} />;
      },
    },
    Text: {
      fields: { text: { type: "richtext", label: "Text", contentEditable: true }, align },
      defaultProps: { text: "<p>Write your message here. Use {{first_name}} to personalize.</p>", align: "left" },
      render: ({ puck, text, align: a }) => {
        const c = ctxFrom(puck.metadata);
        // While editing Puck passes an editable element; otherwise the stored HTML string.
        if (typeof text !== "string")
          return (
            <div
              style={{
                padding: "0 40px 4px",
                textAlign: a,
                fontFamily: c.font,
                fontSize: 16,
                lineHeight: "26px",
                color: c.theme.text,
              }}
            >
              {text}
            </div>
          );
        return <Rows html={BLOCK_HTML.Text({ text, align: a } as never, c)} />;
      },
    },
    Button: {
      fields: {
        label: { type: "text", label: "Label" },
        url: { type: "text", label: "Link URL" },
        align,
        fullWidth: {
          type: "radio",
          label: "Full width",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
      },
      defaultProps: { label: "Get started", url: "https://", align: "left", fullWidth: false },
      render: ({ puck, ...p }) => (
        <Rows
          html={BLOCK_HTML.Button(
            { ...p, label: typeof p.label === "string" ? p.label : "Button" } as never,
            ctxFrom(puck.metadata),
          )}
        />
      ),
    },
    Image: {
      fields: {
        src: { type: "text", label: "Image URL" },
        alt: { type: "text", label: "Description" },
        url: { type: "text", label: "Link (optional)" },
      },
      defaultProps: { src: "", alt: "", url: "" },
      render: ({ puck: _puck, ...p }) =>
        p.src ? (
          <Rows html={BLOCK_HTML.Image(p as never)} />
        ) : (
          <div
            style={{
              margin: "8px 40px 16px",
              padding: 32,
              borderRadius: 8,
              background: "#f3f4f6",
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 13,
            }}
          >
            Image (add an image URL)
          </div>
        ),
    },
    Divider: {
      fields: {},
      render: ({ puck }) => <Rows html={BLOCK_HTML.Divider({} as never, ctxFrom(puck.metadata))} />,
    },
    Spacer: {
      fields: { size: { type: "number", label: "Height (px)", min: 4, max: 120 } },
      defaultProps: { size: 24 },
      render: ({ size }) => <Rows html={BLOCK_HTML.Spacer({ size })} />,
    },
  },
};

let n = 0;
const id = (t: string) => `${t}-${Date.now().toString(36)}${(n++).toString(36)}`;

/** A good-looking starting email. */
export function starterEmail(): EmailDoc {
  return {
    root: { props: { ...DEFAULT_EMAIL_THEME } },
    content: [
      { type: "Heading", props: { id: id("Heading"), text: "Hi {{first_name|there}} 👋", size: "lg", align: "left" } },
      {
        type: "Text",
        props: {
          id: id("Text"),
          text: "<p>Thanks for joining! Here's what you can expect from us: practical tips, no fluff, and the occasional special offer.</p><p>To get started, check out our most popular guide:</p>",
          align: "left",
        },
      },
      {
        type: "Button",
        props: { id: id("Button"), label: "Read the guide", url: "https://", align: "left", fullWidth: false },
      },
      { type: "Text", props: { id: id("Text"), text: "<p>Talk soon,<br>The team</p>", align: "left" } },
    ],
  };
}
