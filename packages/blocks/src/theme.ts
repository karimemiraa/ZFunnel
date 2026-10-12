import type { CSSProperties } from "react";

const SANS = "ui-sans-serif, system-ui, sans-serif";
const SERIF = "ui-serif, Georgia, serif";

/**
 * Arabic typefaces (OFL-1.1, self-hosted through Fontsource, registered in fonts.css).
 * Every @font-face has a unicode-range, so the browser downloads a face only when the page uses it.
 */
export const ARABIC_FONTS = {
  noto: { label: "Noto Sans Arabic", family: "'Noto Sans Arabic Variable'", kind: "sans" },
  cairo: { label: "Cairo", family: "'Cairo Variable'", kind: "sans" },
  tajawal: { label: "Tajawal", family: "'Tajawal'", kind: "sans" },
  plex: { label: "IBM Plex Sans Arabic", family: "'IBM Plex Sans Arabic'", kind: "sans" },
  almarai: { label: "Almarai", family: "'Almarai'", kind: "sans" },
  readex: { label: "Readex Pro", family: "'Readex Pro Variable'", kind: "sans" },
  kufi: { label: "Noto Kufi Arabic", family: "'Noto Kufi Arabic Variable'", kind: "sans" },
  amiri: { label: "Amiri (serif)", family: "'Amiri'", kind: "serif" },
  messiri: { label: "El Messiri (display)", family: "'El Messiri Variable'", kind: "display" },
} as const;
export type ArabicFontKey = keyof typeof ARABIC_FONTS;
/** "auto" follows the Latin font's pair. */
export type ArabicFontChoice = ArabicFontKey | "auto";

/** Latin theme fonts, each paired with an Arabic typeface. */
export const FONTS = {
  inter: { label: "Inter", family: "'Inter Variable'", fallback: SANS, arabic: "plex" },
  jakarta: { label: "Plus Jakarta Sans", family: "'Plus Jakarta Sans Variable'", fallback: SANS, arabic: "cairo" },
  dmsans: { label: "DM Sans", family: "'DM Sans Variable'", fallback: SANS, arabic: "tajawal" },
  manrope: { label: "Manrope", family: "'Manrope Variable'", fallback: SANS, arabic: "almarai" },
  outfit: { label: "Outfit", family: "'Outfit Variable'", fallback: SANS, arabic: "readex" },
  grotesk: { label: "Space Grotesk", family: "'Space Grotesk Variable'", fallback: SANS, arabic: "kufi" },
  playfair: {
    label: "Playfair Display (serif)",
    family: "'Playfair Display Variable'",
    fallback: SERIF,
    arabic: "amiri",
  },
  fraunces: { label: "Fraunces (serif)", family: "'Fraunces Variable'", fallback: SERIF, arabic: "messiri" },
} as const satisfies Record<string, { label: string; family: string; fallback: string; arabic: ArabicFontKey }>;
export type FontKey = keyof typeof FONTS;

/** The Arabic typeface for a Latin font and a choice ("auto" or unknown → the font's pair). */
export function arabicFontFor(latin: string, choice?: string | null): ArabicFontKey {
  if (choice && choice !== "auto" && choice in ARABIC_FONTS) return choice as ArabicFontKey;
  return (FONTS[latin as FontKey] ?? FONTS.inter).arabic;
}

/**
 * The CSS font stack for a Latin font plus its Arabic typeface.
 * - Arabic sites put the Arabic face first, so digits and punctuation inside Arabic text match it and
 *   the Latin font's files are not downloaded at all.
 * - Other sites keep the Latin font first; Arabic text, if any, falls through to the Arabic face.
 * Noto Sans Arabic stays last as a safety net.
 */
export function fontStack(latin: string, choice?: string | null, lang?: string): string {
  const l = FONTS[latin as FontKey] ?? FONTS.inter;
  const a = ARABIC_FONTS[arabicFontFor(latin, choice)].family;
  const families: string[] = lang === "ar" ? [a, l.family] : [l.family, a];
  if (a !== ARABIC_FONTS.noto.family) families.push(ARABIC_FONTS.noto.family);
  return `${families.join(", ")}, ${l.fallback}`;
}

export const RADII = { none: "0px", sm: "6px", md: "12px", lg: "20px", full: "9999px" } as const;
export type RadiusKey = keyof typeof RADII;

export type PageTheme = {
  primary: string;
  background: string;
  text: string;
  headingFont: FontKey;
  bodyFont: FontKey;
  /** Arabic typeface for headings and body text; "auto" uses the Latin font's pair. */
  arabicHeadingFont: ArabicFontChoice;
  arabicBodyFont: ArabicFontChoice;
  radius: RadiusKey;
  buttonRadius: RadiusKey;
};

export const DEFAULT_THEME: PageTheme = {
  primary: "#4f46e5",
  background: "#ffffff",
  text: "#0f172a",
  headingFont: "jakarta",
  bodyFont: "inter",
  arabicHeadingFont: "auto",
  arabicBodyFont: "auto",
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

/** CSS custom properties consumed by every block. `lang` is the site language. */
export function themeVars(input: Partial<PageTheme> | undefined, lang?: string): CSSProperties {
  const t = { ...DEFAULT_THEME, ...input };
  return {
    "--zf-primary": t.primary,
    "--zf-on-primary": contrastText(t.primary),
    "--zf-bg": t.background,
    "--zf-fg": t.text,
    "--zf-text": t.text,
    "--zf-heading-font": fontStack(t.headingFont, t.arabicHeadingFont, lang),
    "--zf-body-font": fontStack(t.bodyFont, t.arabicBodyFont, lang),
    "--zf-radius": RADII[t.radius] ?? RADII.md,
    "--zf-btn-radius": RADII[t.buttonRadius] ?? RADII.md,
    colorScheme: isDark(t.background) ? "dark" : "light",
  } as CSSProperties;
}
