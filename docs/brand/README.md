# ZFunnel brand

`zfunnel-logo-source.webp` is the owner's original artwork. The SVGs in the code are hand-drawn from it (no tracing, no dependencies), in the source's 1932px coordinate space.

## The mark

A bold rounded "Z":

- The top bar and diagonal are orange `#F28A22`, a single stroke 166 units wide with round caps.
- The bottom bar and a short diagonal stub are white on dark backgrounds and navy `#001A57` on light ones.
- A small notch (radius 112) separates the stub from the orange end.

| Variant        | Where                                        | Code                                                         |
| -------------- | -------------------------------------------- | ------------------------------------------------------------ |
| App icon       | Favicon, apple-touch icon, sidebar, wordmark | `AppIcon` in `apps/web/components/logo.tsx`, `app/icon.svg`  |
| Mark, dark bg  | Auth panel, onboarding band                  | `<LogoMark tone="dark" />`                                   |
| Mark, light bg | "Powered by" badge on published sites        | `<LogoMark tone="light" />`, `apps/sites/app/powered-by.tsx` |
| Wordmark       | Dashboard chrome                             | `<Logo />` (icon plus "ZFunnel", the Z in orange)            |

`app/apple-icon.png` (180px, full square) is rendered from `icon.svg` with Playwright. Re-render it if the mark changes.

Usage:

- Keep the mark's proportions. Don't recolor the orange, rotate the mark or add effects.
- Leave clear space of at least half the icon's width around it.
- The wordmark is always written "ZFunnel" and stays left-to-right in Arabic.

## Colors

| Token                | Light     | Dark      | Use                                               |
| -------------------- | --------- | --------- | ------------------------------------------------- |
| `brand-orange`       | `#F28A22` | `#F28A22` | The mark, highlights, progress, focus ring        |
| `primary`            | `#B85A06` | `#F28A22` | Buttons and links                                 |
| `primary-foreground` | `#FFFFFF` | `#001A57` | Text on primary                                   |
| `brand-orange-text`  | `#B85A06` | `#F28A22` | Orange text and icons on the page background      |
| `brand-navy`         | `#001A57` | `#001A57` | Dark brand surfaces (auth panel), sidebar accents |

Contrast (WCAG 2.x):

- `#B85A06` on white is 4.66:1, which passes AA for normal text. Bright `#F28A22` on white is only 2.49:1, so it is never used for text on white.
- `#001A57` on `#F28A22` is 6.56:1 (dark-mode buttons).
- Navy on white is 16.3:1.

The tokens live in `packages/ui/src/styles/globals.css` and only style the platform chrome. Published funnel pages are styled by each workspace's own theme (`--zf-*` variables in `@zfunnel/blocks`) and are not affected. Built-in customer emails (worker) use the workspace's brand color, not ZFunnel's.

## Screenshots

`screenshots/` holds a before/after of the Phase 7.2 pass (sign-in in English and Arabic, workspace home).
