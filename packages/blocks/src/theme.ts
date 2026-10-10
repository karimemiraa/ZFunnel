import type { CSSProperties } from "react";

export const FONTS = {
  inter: { label: "Inter", stack: "'Inter Variable', ui-sans-serif, system-ui, sans-serif" },
  jakarta: { label: "Plus Jakarta Sans", stack: "'Plus Jakarta Sans Variable', ui-sans-serif, system-ui, sans-serif" },
  dmsans: { label: "DM Sans", stack: "'DM Sans Variable', ui-sans-serif, system-ui, sans-serif" },
  manrope: { label: "Manrope", stack: "'Manrope Variable', ui-sans-serif, system-ui, sans-serif" },
  outfit: { label: "Outfit", stack: "'Outfit Variable', ui-sans-serif, system-ui, sans-serif" },
  grotesk: { label: "Space Grotesk", stack: "'Space Grotesk Variable', ui-sans-serif, system-ui, sans-serif" },
  playfair: { label: "Playfair Display (serif)", stack: "'Playfair Display Variable', ui-serif, Georgia, serif" },
  fraunces: { label: "Fraunces (serif)", stack: "'Fraunces Variable', ui-serif, Georgia, serif" },
} as const;
export type FontKey = keyof typeof FONTS;

export const RADII = { none: "0px", sm: "6px", md: "12px", lg: "20px", full: "9999px" } as const;
export type RadiusKey = keyof typeof RADII;

export type PageTheme = {
  primary: string;
  background: string;
  text: string;
  headingFont: FontKey;
  bodyFont: FontKey;
  radius: RadiusKey;
  buttonRadius: RadiusKey;
};

export const DEFAULT_THEME: PageTheme = {
  primary: "#4f46e5",
  background: "#ffffff",
  text: "#0f172a",
  headingFont: "jakarta",
  bodyFont: "inter",
  radius: "md",
  buttonRadius: "md",
};

/** Ready-made palettes shown in the page settings. */
export const THEME_PRESETS: { name: string; theme: Partial<PageTheme> }[] = [
  { name: "Indigo", theme: { primary: "#4f46e5", background: "#ffffff", text: "#0f172a" } },
  { name: "Emerald", theme: { primary: "#059669", background: "#ffffff", text: "#052e16" } },
  { name: "Sunset", theme: { primary: "#ea580c", background: "#fffaf5", text: "#1c1917" } },
  { name: "Rose", theme: { primary: "#e11d48", background: "#fff7f8", text: "#1f1720" } },
  { name: "Midnight", theme: { primary: "#a78bfa", background: "#0b0b14", text: "#f4f4f8" } },
  { name: "Gold", theme: { primary: "#b45309", background: "#fdfbf6", text: "#1c1a17" } },
];

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? [...m[1]!].map((c) => c + c).join("") : m[1]!;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Black or white text, whichever reads better on the given background. */
export function contrastText(bg: string): string {
  return luminance(bg) > 0.45 ? "#0b0b0f" : "#ffffff";
}

export function isDark(hex: string) {
  return luminance(hex) < 0.3;
}

/** CSS custom properties consumed by every block. */
export function themeVars(input: Partial<PageTheme> | undefined): CSSProperties {
  const t = { ...DEFAULT_THEME, ...input };
  return {
    "--zf-primary": t.primary,
    "--zf-on-primary": contrastText(t.primary),
    "--zf-bg": t.background,
    "--zf-fg": t.text,
    "--zf-text": t.text,
    "--zf-heading-font": FONTS[t.headingFont]?.stack ?? FONTS.inter.stack,
    "--zf-body-font": FONTS[t.bodyFont]?.stack ?? FONTS.inter.stack,
    "--zf-radius": RADII[t.radius] ?? RADII.md,
    "--zf-btn-radius": RADII[t.buttonRadius] ?? RADII.md,
    colorScheme: isDark(t.background) ? "dark" : "light",
  } as CSSProperties;
}
