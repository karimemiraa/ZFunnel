import { useId } from "react";
import { cn } from "@zfunnel/ui/lib/utils";

/*
 * The ZFunnel mark, hand-drawn from docs/brand/zfunnel-logo-source.webp (see docs/brand/README.md).
 * Coordinates are in the source image's 1932px space. The orange stroke is the top bar and
 * diagonal; the second path is the bottom bar with its short stub, notched around the orange end.
 */
const ORANGE = "M681 582H1265L952 985";
const BASE =
  "M971.3 1095.3A112 112 0 0 1 840.3 993.5L603.5 1298.1A83 83 0 0 0 669 1432H1250A83 83 0 0 0 1250 1266H838.6Z";

function Glyph({ base }: { base: string }) {
  return (
    <>
      <path d={ORANGE} fill="none" stroke="#F28A22" strokeWidth="166" strokeLinecap="round" strokeLinejoin="round" />
      <path d={BASE} fill={base} />
    </>
  );
}

/**
 * The standalone "Z". `tone="dark"` is for dark backgrounds (white base), `tone="light"` for light
 * backgrounds (navy base), and `auto` follows the dashboard theme.
 */
export function LogoMark({ className, tone = "auto" }: { className?: string; tone?: "auto" | "light" | "dark" }) {
  return (
    <svg
      viewBox="570 486 792 960"
      aria-hidden
      className={cn(
        "h-7 w-auto shrink-0",
        tone === "dark" && "text-white",
        tone === "light" && "text-brand-navy",
        tone === "auto" && "text-brand-navy dark:text-white",
        className,
      )}
    >
      <Glyph base="currentColor" />
    </svg>
  );
}

/** The app icon: the mark on the navy gradient rounded square (favicon, sidebar, auth panel). */
export function AppIcon({ className }: { className?: string }) {
  // Unique gradient ids: a hidden icon elsewhere on the page must not break this one.
  const id = "zf" + useId().replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <svg viewBox="0 0 1932 1932" aria-hidden className={cn("size-7 shrink-0", className)}>
      <defs>
        <linearGradient id={`${id}bg`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000F3A" />
          <stop offset=".55" stopColor="#00226B" />
          <stop offset="1" stopColor="#00307F" />
        </linearGradient>
        <radialGradient id={`${id}glow`} cx="1" cy="1" r=".75">
          <stop offset="0" stopColor="#1C82C2" />
          <stop offset="1" stopColor="#1C82C2" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1932" height="1932" rx="440" fill={`url(#${id}bg)`} />
      <rect width="1932" height="1932" rx="440" fill={`url(#${id}glow)`} />
      <g transform="translate(966 966) scale(1.25) translate(-966 -966)">
        <Glyph base="#fff" />
      </g>
    </svg>
  );
}

/** The wordmark: app icon plus "ZFunnel". `showText={false}` keeps only the icon. */
export function Logo({ className, showText = true }: { className?: string; showText?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-base font-bold tracking-tight", className)}>
      <AppIcon className="size-[1.75em]" />
      {showText && (
        <span dir="ltr">
          <span className="text-brand-orange-text dark:text-brand-orange">Z</span>Funnel
        </span>
      )}
      {!showText && <span className="sr-only">ZFunnel</span>}
    </span>
  );
}
