import { emailRichText, esc, safeHref } from "./html";

export const EMAIL_FONTS = {
  system: {
    label: "System (modern)",
    stack: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
  },
  helvetica: { label: "Helvetica / Arial", stack: "Helvetica,Arial,sans-serif" },
  georgia: { label: "Georgia (serif)", stack: "Georgia,'Times New Roman',serif" },
  verdana: { label: "Verdana", stack: "Verdana,Geneva,sans-serif" },
} as const;

export type EmailTheme = {
  brand: string;
  background: string;
  card: string;
  text: string;
  font: keyof typeof EMAIL_FONTS;
};
export const DEFAULT_EMAIL_THEME: EmailTheme = {
  brand: "#4f46e5",
  background: "#f4f4f7",
  card: "#ffffff",
  text: "#1f2330",
  font: "system",
};

export type Ctx = { theme: EmailTheme; font: string };
type Align = "left" | "center" | "right";
const cell = (inner: string, pad = "0 40px 16px", align: Align = "left") =>
  `<tr><td align="${align}" style="padding:${pad};text-align:${align}">${inner}</td></tr>`;

export const BLOCK_HTML = {
  Logo: (p: { src: string; width: number; align: Align }) =>
    p.src
      ? cell(
          `<img src="${esc(safeHref(p.src))}" width="${Number(p.width) || 120}" alt="" style="display:inline-block;border:0;outline:none;max-width:100%;height:auto">`,
          "32px 40px 8px",
          p.align,
        )
      : "",
  Heading: (p: { text: string; size: "lg" | "md" | "sm"; align: Align }, c: Ctx) => {
    const size = { lg: 30, md: 24, sm: 19 }[p.size] ?? 24;
    return cell(
      `<h1 style="margin:0;font-family:${c.font};font-size:${size}px;line-height:1.25;font-weight:700;color:${c.theme.text}">${esc(p.text)}</h1>`,
      "8px 40px 16px",
      p.align,
    );
  },
  Text: (p: { text: string; align: Align }, c: Ctx) =>
    cell(
      `<div style="text-align:${p.align}">${emailRichText(p.text, { text: c.theme.text, link: c.theme.brand, font: c.font })}</div>`,
      "0 40px 4px",
      p.align,
    ),
  Button: (p: { label: string; url: string; align: Align; fullWidth: boolean }, c: Ctx) => {
    const href = esc(safeHref(p.url));
    // Bulletproof button: a table cell with background works in Outlook too.
    return cell(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ${p.fullWidth ? 'width="100%"' : ""} style="display:inline-table"><tr><td align="center" bgcolor="${c.theme.brand}" style="border-radius:8px;background:${c.theme.brand}"><a href="${href}" style="display:block;padding:14px 28px;font-family:${c.font};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px">${esc(p.label)}</a></td></tr></table>`,
      "8px 40px 24px",
      p.align,
    );
  },
  Image: (p: { src: string; alt: string; url: string }) => {
    if (!p.src) return "";
    const img = `<img src="${esc(safeHref(p.src))}" width="520" alt="${esc(p.alt)}" style="display:block;width:100%;max-width:520px;height:auto;border:0;border-radius:8px">`;
    return cell(p.url ? `<a href="${esc(safeHref(p.url))}">${img}</a>` : img, "8px 40px 16px", "center");
  },
  Divider: (_p: Record<string, never>, c: Ctx) =>
    cell(`<div style="height:1px;line-height:1px;background:${c.theme.text}22">&nbsp;</div>`, "16px 40px"),
  Spacer: (p: { size: number }) =>
    `<tr><td style="height:${Math.max(4, Math.min(120, Number(p.size) || 24))}px;line-height:1px;font-size:1px">&nbsp;</td></tr>`,
} as const;

export type EmailBlockType = keyof typeof BLOCK_HTML;
