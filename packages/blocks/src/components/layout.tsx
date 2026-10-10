import type { ComponentConfig, Slot } from "@puckeditor/core";
import type { CSSProperties } from "react";
import { colorField, hideOnField, type HideOn } from "../fields";
import { contrastText } from "../theme";
import { cx, hideClass } from "../utils";

const WIDTHS = { narrow: "max-w-3xl", normal: "max-w-6xl", wide: "max-w-7xl", full: "max-w-none" } as const;
const PADDING = {
  none: "py-0",
  sm: "py-8 md:py-10",
  md: "py-12 md:py-16",
  lg: "py-16 md:py-24",
  xl: "py-24 md:py-32",
} as const;
const GAPS = { sm: "gap-3", md: "gap-5", lg: "gap-8" } as const;

export type SectionProps = {
  content: Slot;
  background: "page" | "subtle" | "primary" | "dark" | "custom" | "gradient" | "image";
  customColor: string;
  imageUrl: string;
  overlay: number;
  width: keyof typeof WIDTHS;
  padding: keyof typeof PADDING;
  gap: keyof typeof GAPS;
  align: "left" | "center";
  anchor: string;
  hideOn: HideOn;
};

function sectionStyle(p: Omit<SectionProps, "content">): CSSProperties {
  switch (p.background) {
    case "subtle":
      return { background: "color-mix(in srgb, var(--zf-fg) 4%, var(--zf-bg))" };
    case "primary":
      return { background: "var(--zf-primary)", "--zf-fg": "var(--zf-on-primary)" } as CSSProperties;
    case "dark":
      return { background: "#0b0b12", "--zf-fg": "#f5f5f7", "--zf-on-primary": "#fff" } as CSSProperties;
    case "custom":
      return { background: p.customColor, "--zf-fg": contrastText(p.customColor || "#ffffff") } as CSSProperties;
    case "gradient":
      return {
        background:
          "radial-gradient(1200px 500px at 50% -10%, color-mix(in srgb, var(--zf-primary) 22%, transparent), transparent 70%), var(--zf-bg)",
      };
    case "image":
      return {
        backgroundImage: `linear-gradient(rgba(5,5,10,${(p.overlay ?? 50) / 100}), rgba(5,5,10,${(p.overlay ?? 50) / 100})), url("${encodeURI(p.imageUrl || "")}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        "--zf-fg": "#ffffff",
      } as CSSProperties;
    default:
      return {};
  }
}

export const Section: ComponentConfig<SectionProps> = {
  label: "Section",
  fields: {
    content: { type: "slot" },
    background: {
      type: "select",
      label: "Background",
      options: [
        { label: "Page", value: "page" },
        { label: "Subtle", value: "subtle" },
        { label: "Brand color", value: "primary" },
        { label: "Dark", value: "dark" },
        { label: "Brand glow", value: "gradient" },
        { label: "Custom color", value: "custom" },
        { label: "Image", value: "image" },
      ],
    },
    customColor: colorField("Custom color"),
    imageUrl: { type: "text", label: "Image URL" },
    overlay: { type: "number", label: "Darken image (%)", min: 0, max: 90, step: 5 },
    width: {
      type: "select",
      label: "Content width",
      options: [
        { label: "Narrow", value: "narrow" },
        { label: "Normal", value: "normal" },
        { label: "Wide", value: "wide" },
        { label: "Full", value: "full" },
      ],
    },
    padding: {
      type: "select",
      label: "Vertical padding",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra large", value: "xl" },
      ],
    },
    gap: {
      type: "radio",
      label: "Spacing between elements",
      options: [
        { label: "S", value: "sm" },
        { label: "M", value: "md" },
        { label: "L", value: "lg" },
      ],
    },
    align: {
      type: "radio",
      label: "Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
      ],
    },
    anchor: { type: "text", label: "Anchor ID (for scroll links)" },
    hideOn: hideOnField,
  },
  resolveFields: (data, { fields }) => ({
    ...fields,
    customColor: { ...fields.customColor, visible: data.props.background === "custom" },
    imageUrl: { ...fields.imageUrl, visible: data.props.background === "image" },
    overlay: { ...fields.overlay, visible: data.props.background === "image" },
  }),
  defaultProps: {
    content: [],
    background: "page",
    customColor: "#f4f4f5",
    imageUrl: "",
    overlay: 55,
    width: "normal",
    padding: "lg",
    gap: "md",
    align: "center",
    anchor: "",
    hideOn: "none",
  },
  render: (p) => {
    const Content = p.content;
    return (
      <section
        id={p.anchor || undefined}
        data-align={p.align}
        className={cx("zf-section relative w-full px-5 md:px-8", PADDING[p.padding], hideClass(p.hideOn))}
        style={{ ...sectionStyle(p), color: "var(--zf-fg)" }}
      >
        <Content
          className={cx(
            "mx-auto flex w-full flex-col",
            WIDTHS[p.width],
            GAPS[p.gap],
            // Always stretch: Puck wraps blocks in a div that would otherwise shrink to zero width.
            // Blocks align themselves (text-align is inherited; wide blocks center with mx-auto).
            "items-stretch",
            p.align === "center" ? "text-center" : "text-start",
          )}
          minEmptyHeight={120}
        />
      </section>
    );
  },
};

export type ColumnsProps = {
  c1: Slot;
  c2: Slot;
  c3: Slot;
  c4: Slot;
  count: "2" | "3" | "4";
  ratio: "equal" | "wide-left" | "wide-right";
  gap: "sm" | "md" | "lg";
  valign: "top" | "center";
  reverseOnMobile: boolean;
  hideOn: HideOn;
};

const GRID: Record<string, string> = {
  "2-equal": "md:grid-cols-2",
  "2-wide-left": "md:grid-cols-[3fr_2fr]",
  "2-wide-right": "md:grid-cols-[2fr_3fr]",
  "3-equal": "md:grid-cols-3",
  "4-equal": "md:grid-cols-2 lg:grid-cols-4",
};

export const Columns: ComponentConfig<ColumnsProps> = {
  label: "Columns",
  fields: {
    c1: { type: "slot" },
    c2: { type: "slot" },
    c3: { type: "slot" },
    c4: { type: "slot" },
    count: {
      type: "radio",
      label: "Columns",
      options: [
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
      ],
    },
    ratio: {
      type: "select",
      label: "Width ratio (2 columns)",
      options: [
        { label: "Equal", value: "equal" },
        { label: "Wider left", value: "wide-left" },
        { label: "Wider right", value: "wide-right" },
      ],
    },
    gap: {
      type: "radio",
      label: "Gap",
      options: [
        { label: "S", value: "sm" },
        { label: "M", value: "md" },
        { label: "L", value: "lg" },
      ],
    },
    valign: {
      type: "radio",
      label: "Vertical alignment",
      options: [
        { label: "Top", value: "top" },
        { label: "Center", value: "center" },
      ],
    },
    reverseOnMobile: {
      type: "radio",
      label: "Order on mobile",
      options: [
        { label: "Normal", value: false },
        { label: "Reversed", value: true },
      ],
    },
    hideOn: hideOnField,
  },
  resolveFields: (data, { fields }) => ({ ...fields, ratio: { ...fields.ratio, visible: data.props.count === "2" } }),
  defaultProps: {
    c1: [],
    c2: [],
    c3: [],
    c4: [],
    count: "2",
    ratio: "equal",
    gap: "lg",
    valign: "center",
    reverseOnMobile: false,
    hideOn: "none",
  },
  render: (p) => {
    const n = Number(p.count);
    const key = n === 2 ? `2-${p.ratio}` : `${n}-equal`;
    const slots = [p.c1, p.c2, p.c3, p.c4].slice(0, n);
    return (
      <div
        className={cx(
          "zf-cols grid w-full grid-cols-1 text-start",
          GRID[key],
          { sm: "gap-4", md: "gap-8", lg: "gap-10 md:gap-14" }[p.gap],
          p.valign === "center" ? "items-center" : "items-start",
          hideClass(p.hideOn),
        )}
      >
        {slots.map((Col, i) => (
          <Col
            key={i}
            className={cx(
              "flex min-w-0 flex-col gap-5",
              p.reverseOnMobile && (i === 0 ? "max-md:order-2" : "max-md:order-1"),
            )}
            minEmptyHeight={80}
          />
        ))}
      </div>
    );
  },
};

export type SpacerProps = { size: "xs" | "sm" | "md" | "lg" | "xl" };
export const Spacer: ComponentConfig<SpacerProps> = {
  label: "Spacer",
  fields: {
    size: {
      type: "select",
      label: "Height",
      options: [
        { label: "Extra small", value: "xs" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra large", value: "xl" },
      ],
    },
  },
  defaultProps: { size: "md" },
  render: ({ size }) => (
    <div aria-hidden className={{ xs: "h-2", sm: "h-4", md: "h-8", lg: "h-16", xl: "h-24" }[size]} />
  ),
};

export type DividerProps = { style: "line" | "dashed" | "fade"; width: "short" | "full" };
export const Divider: ComponentConfig<DividerProps> = {
  label: "Divider",
  fields: {
    style: {
      type: "radio",
      label: "Style",
      options: [
        { label: "Line", value: "line" },
        { label: "Dashed", value: "dashed" },
        { label: "Fade", value: "fade" },
      ],
    },
    width: {
      type: "radio",
      label: "Width",
      options: [
        { label: "Short", value: "short" },
        { label: "Full", value: "full" },
      ],
    },
  },
  defaultProps: { style: "line", width: "full" },
  render: ({ style, width }) => (
    <hr
      className={cx("mx-auto border-0", width === "short" ? "w-24" : "w-full")}
      style={{
        height: 1,
        background:
          style === "fade"
            ? "linear-gradient(90deg, transparent, color-mix(in srgb, var(--zf-fg) 25%, transparent), transparent)"
            : style === "dashed"
              ? "repeating-linear-gradient(90deg, color-mix(in srgb, var(--zf-fg) 25%, transparent) 0 8px, transparent 8px 14px)"
              : "color-mix(in srgb, var(--zf-fg) 14%, transparent)",
      }}
    />
  ),
};
