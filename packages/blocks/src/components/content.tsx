import type { ComponentConfig, RichText } from "@puckeditor/core";
import type * as React from "react";
import {
  ArrowRightIcon,
  CheckIcon,
  ChevronRightIcon,
  CircleIcon,
  ImageIcon,
  PlayIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import { alignField, hideOnField, type Align, type HideOn } from "../fields";
import { getRuntime } from "../runtime";
import { alignText, cx, hideClass, justify, toEmbed } from "../utils";

const HEADING_SIZES = {
  display: "text-[clamp(2.4rem,6vw,4.75rem)] leading-[1.02] tracking-[-0.035em] font-extrabold",
  xl: "text-[clamp(2rem,4.5vw,3.5rem)] leading-[1.08] tracking-[-0.03em] font-bold",
  lg: "text-[clamp(1.6rem,3.2vw,2.5rem)] leading-[1.15] tracking-[-0.02em] font-bold",
  md: "text-[clamp(1.3rem,2.2vw,1.75rem)] leading-[1.25] tracking-[-0.01em] font-semibold",
  sm: "text-lg leading-snug font-semibold",
} as const;

export type HeadingProps = {
  text: string;
  level: "h1" | "h2" | "h3" | "h4";
  size: keyof typeof HEADING_SIZES;
  align: Align;
  highlight: string;
  color: "default" | "primary";
};

/** Wraps the first occurrence of `highlight` in a brand-coloured span. */
function withHighlight(text: React.ReactNode, highlight: string) {
  // While editing inline, Puck passes an editable element instead of a string.
  if (typeof text !== "string") return text;
  const i = highlight ? text.toLowerCase().indexOf(highlight.toLowerCase()) : -1;
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span style={{ color: "var(--zf-primary)" }}>{text.slice(i, i + highlight.length)}</span>
      {text.slice(i + highlight.length)}
    </>
  );
}

export const Heading: ComponentConfig<HeadingProps> = {
  label: "Heading",
  fields: {
    text: { type: "textarea", label: "Text", contentEditable: true },
    highlight: { type: "text", label: "Highlight words (brand color)" },
    level: {
      type: "select",
      label: "HTML level (SEO)",
      options: [
        { label: "H1 (once per page)", value: "h1" },
        { label: "H2", value: "h2" },
        { label: "H3", value: "h3" },
        { label: "H4", value: "h4" },
      ],
    },
    size: {
      type: "select",
      label: "Size",
      options: [
        { label: "Display", value: "display" },
        { label: "Extra large", value: "xl" },
        { label: "Large", value: "lg" },
        { label: "Medium", value: "md" },
        { label: "Small", value: "sm" },
      ],
    },
    color: {
      type: "radio",
      label: "Color",
      options: [
        { label: "Text", value: "default" },
        { label: "Brand", value: "primary" },
      ],
    },
    align: alignField,
  },
  defaultProps: {
    text: "Turn visitors into customers",
    highlight: "",
    level: "h2",
    size: "xl",
    align: "center",
    color: "default",
  },
  render: ({ text, level: Tag, size, align, highlight, color }) => (
    <Tag
      className={cx("w-full text-balance", HEADING_SIZES[size], alignText[align])}
      style={{ fontFamily: "var(--zf-heading-font)", color: color === "primary" ? "var(--zf-primary)" : undefined }}
    >
      {withHighlight(text, highlight)}
    </Tag>
  ),
};

export type TextProps = {
  text: RichText;
  size: "sm" | "md" | "lg" | "xl";
  align: Align;
  muted: boolean;
  maxWidth: "full" | "readable";
};

export const Text: ComponentConfig<TextProps> = {
  label: "Text",
  fields: {
    text: { type: "richtext", label: "Text", contentEditable: true },
    size: {
      type: "radio",
      label: "Size",
      options: [
        { label: "S", value: "sm" },
        { label: "M", value: "md" },
        { label: "L", value: "lg" },
        { label: "XL", value: "xl" },
      ],
    },
    muted: {
      type: "radio",
      label: "Tone",
      options: [
        { label: "Normal", value: false },
        { label: "Soft", value: true },
      ],
    },
    maxWidth: {
      type: "radio",
      label: "Line length",
      options: [
        { label: "Readable", value: "readable" },
        { label: "Full", value: "full" },
      ],
    },
    align: alignField,
  },
  defaultProps: {
    text: "<p>Explain the transformation your offer delivers. Keep it short, specific and about the reader.</p>",
    size: "lg",
    align: "center",
    muted: true,
    maxWidth: "readable",
  },
  render: ({ text, size, align, muted, maxWidth }) => (
    <div
      className={cx(
        "zf-prose w-full",
        { sm: "text-sm", md: "text-base", lg: "text-lg", xl: "text-xl" }[size],
        alignText[align],
        maxWidth === "readable" && "max-w-2xl",
        maxWidth === "readable" && align === "center" && "mx-auto",
      )}
      style={{ color: muted ? "color-mix(in srgb, var(--zf-fg) 72%, transparent)" : undefined }}
    >
      {text}
    </div>
  ),
};

export type BadgeProps = { text: string; style: "soft" | "solid" | "outline"; icon: "none" | "star" | "dot" };
export const Badge: ComponentConfig<BadgeProps> = {
  label: "Badge",
  fields: {
    text: { type: "text", label: "Text", contentEditable: true },
    style: {
      type: "radio",
      label: "Style",
      options: [
        { label: "Soft", value: "soft" },
        { label: "Solid", value: "solid" },
        { label: "Outline", value: "outline" },
      ],
    },
    icon: {
      type: "radio",
      label: "Icon",
      options: [
        { label: "None", value: "none" },
        { label: "Star", value: "star" },
        { label: "Live dot", value: "dot" },
      ],
    },
  },
  defaultProps: { text: "New masterclass", style: "soft", icon: "dot" },
  render: ({ text, style, icon }) => (
    <div>
      <span
        className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase"
        style={
          style === "solid"
            ? { background: "var(--zf-primary)", color: "var(--zf-on-primary)" }
            : style === "outline"
              ? {
                  border: "1px solid color-mix(in srgb, var(--zf-primary) 45%, transparent)",
                  color: "var(--zf-primary)",
                }
              : { background: "color-mix(in srgb, var(--zf-primary) 12%, transparent)", color: "var(--zf-primary)" }
        }
      >
        {icon === "star" && <StarIcon className="size-3.5 fill-current" />}
        {icon === "dot" && (
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-current" />
          </span>
        )}
        {text}
      </span>
    </div>
  ),
};

export type ButtonProps = {
  label: string;
  sublabel: string;
  action: "next" | "url" | "anchor";
  url: string;
  anchor: string;
  newTab: boolean;
  variant: "solid" | "outline" | "soft";
  size: "md" | "lg" | "xl";
  align: Align;
  fullWidth: boolean;
  arrow: boolean;
  hideOn: HideOn;
};

export const Button: ComponentConfig<ButtonProps> = {
  label: "Button",
  fields: {
    label: { type: "text", label: "Label", contentEditable: true },
    sublabel: { type: "text", label: "Small text under label" },
    action: {
      type: "select",
      label: "When clicked",
      options: [
        { label: "Go to next funnel step", value: "next" },
        { label: "Open a URL", value: "url" },
        { label: "Scroll to a section", value: "anchor" },
      ],
    },
    url: { type: "text", label: "URL" },
    anchor: { type: "text", label: "Section anchor ID" },
    newTab: {
      type: "radio",
      label: "Open in new tab",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    variant: {
      type: "radio",
      label: "Style",
      options: [
        { label: "Solid", value: "solid" },
        { label: "Soft", value: "soft" },
        { label: "Outline", value: "outline" },
      ],
    },
    size: {
      type: "radio",
      label: "Size",
      options: [
        { label: "M", value: "md" },
        { label: "L", value: "lg" },
        { label: "XL", value: "xl" },
      ],
    },
    align: alignField,
    fullWidth: {
      type: "radio",
      label: "Full width",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    arrow: {
      type: "radio",
      label: "Arrow icon",
      options: [
        { label: "Hide", value: false },
        { label: "Show", value: true },
      ],
    },
    hideOn: hideOnField,
  },
  resolveFields: (data, { fields }) => ({
    ...fields,
    url: { ...fields.url, visible: data.props.action === "url" },
    newTab: { ...fields.newTab, visible: data.props.action === "url" },
    anchor: { ...fields.anchor, visible: data.props.action === "anchor" },
  }),
  defaultProps: {
    label: "Yes! I want this",
    sublabel: "",
    action: "next",
    url: "",
    anchor: "",
    newTab: false,
    variant: "solid",
    size: "lg",
    align: "center",
    fullWidth: false,
    arrow: true,
    hideOn: "none",
  },
  render: (p) => {
    const rt = getRuntime(p.puck.metadata);
    const href =
      p.action === "url"
        ? safeUrl(p.url)
        : p.action === "anchor"
          ? `#${p.anchor.replace(/^#/, "")}`
          : (rt.nextUrl ?? "#");
    return (
      <div className={cx("flex w-full", justify[p.align], hideClass(p.hideOn))}>
        <a
          href={href}
          target={p.action === "url" && p.newTab ? "_blank" : undefined}
          rel={p.action === "url" && p.newTab ? "noopener noreferrer" : undefined}
          data-zf-button
          className={cx(
            "zf-btn group inline-flex flex-col items-center justify-center text-center font-semibold transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0",
            {
              md: "min-h-11 px-6 py-2.5 text-[15px]",
              lg: "min-h-14 px-8 py-3.5 text-lg",
              xl: "min-h-16 px-10 py-4 text-xl",
            }[p.size],
            p.fullWidth && "w-full",
          )}
          style={{
            borderRadius: "var(--zf-btn-radius)",
            ...(p.variant === "solid"
              ? {
                  background: "var(--zf-primary)",
                  color: "var(--zf-on-primary)",
                  boxShadow:
                    "0 10px 30px -10px color-mix(in srgb, var(--zf-primary) 70%, transparent), inset 0 1px 0 rgba(255,255,255,.18)",
                }
              : p.variant === "soft"
                ? { background: "color-mix(in srgb, var(--zf-primary) 12%, transparent)", color: "var(--zf-primary)" }
                : { border: "2px solid var(--zf-primary)", color: "var(--zf-primary)" }),
          }}
        >
          <span className="inline-flex items-center gap-2">
            {p.label}
            {p.arrow && <ArrowRightIcon className="size-[1.1em] transition-transform group-hover:translate-x-1" />}
          </span>
          {p.sublabel && <span className="mt-0.5 text-[0.72em] font-normal opacity-80">{p.sublabel}</span>}
        </a>
      </div>
    );
  },
};

/** Only allow http(s), mailto and tel links in user-provided URLs. */
export function safeUrl(url: string) {
  const u = url.trim();
  if (/^(https?:|mailto:|tel:|\/|#)/i.test(u)) return u;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(u)) return `https://${u}`;
  return "#";
}

export type ImageProps = {
  src: string;
  alt: string;
  width: "auto" | "full";
  maxWidth: number;
  aspect: "auto" | "16/9" | "4/3" | "1/1" | "3/4";
  rounded: boolean;
  shadow: boolean;
  align: Align;
  hideOn: HideOn;
};

export const Image: ComponentConfig<ImageProps> = {
  label: "Image",
  fields: {
    src: { type: "text", label: "Image URL" },
    alt: { type: "text", label: "Description (for SEO & accessibility)" },
    width: {
      type: "radio",
      label: "Width",
      options: [
        { label: "Fit", value: "auto" },
        { label: "Full", value: "full" },
      ],
    },
    maxWidth: { type: "number", label: "Max width (px)", min: 40, max: 2400, step: 10 },
    aspect: {
      type: "select",
      label: "Crop",
      options: [
        { label: "Original", value: "auto" },
        { label: "Landscape 16:9", value: "16/9" },
        { label: "Classic 4:3", value: "4/3" },
        { label: "Square", value: "1/1" },
        { label: "Portrait 3:4", value: "3/4" },
      ],
    },
    rounded: {
      type: "radio",
      label: "Rounded corners",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    shadow: {
      type: "radio",
      label: "Shadow",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    align: alignField,
    hideOn: hideOnField,
  },
  defaultProps: {
    src: "",
    alt: "",
    width: "full",
    maxWidth: 1200,
    aspect: "auto",
    rounded: true,
    shadow: true,
    align: "center",
    hideOn: "none",
  },
  render: (p) => {
    const frame = cx(
      "block overflow-hidden",
      p.width === "full" && "w-full",
      p.shadow && "shadow-[0_30px_80px_-30px_rgba(0,0,0,.45)]",
    );
    const style = {
      borderRadius: p.rounded ? "var(--zf-radius)" : 0,
      maxWidth: p.maxWidth,
      aspectRatio: p.aspect === "auto" ? undefined : p.aspect,
    };
    return (
      <div className={cx("flex w-full", justify[p.align], hideClass(p.hideOn))}>
        {p.src ? (
          // eslint-disable-next-line @next/next/no-img-element -- published pages use plain <img> with lazy loading
          <img
            src={p.src}
            alt={p.alt}
            loading="lazy"
            decoding="async"
            className={cx(frame, "object-cover")}
            style={style}
          />
        ) : (
          <div
            className={cx(frame, "flex aspect-video w-full items-center justify-center")}
            style={{
              ...style,
              background: "color-mix(in srgb, var(--zf-primary) 10%, var(--zf-bg))",
              color: "var(--zf-primary)",
            }}
          >
            <span className="flex flex-col items-center gap-2 text-sm font-medium opacity-80">
              <ImageIcon className="size-8" /> Add an image URL
            </span>
          </div>
        )}
      </div>
    );
  },
};

export type VideoProps = {
  url: string;
  rounded: boolean;
  shadow: boolean;
  maxWidth: "md" | "lg" | "full";
  autoplay: boolean;
};
export const Video: ComponentConfig<VideoProps> = {
  label: "Video",
  fields: {
    url: { type: "text", label: "YouTube, Vimeo or .mp4 URL" },
    maxWidth: {
      type: "radio",
      label: "Size",
      options: [
        { label: "M", value: "md" },
        { label: "L", value: "lg" },
        { label: "Full", value: "full" },
      ],
    },
    autoplay: {
      type: "radio",
      label: "Autoplay (muted)",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    rounded: {
      type: "radio",
      label: "Rounded",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    shadow: {
      type: "radio",
      label: "Shadow",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
  },
  defaultProps: { url: "", rounded: true, shadow: true, maxWidth: "lg", autoplay: false },
  render: (p) => {
    const embed = toEmbed(p.url);
    const src =
      embed && p.autoplay && embed.kind === "iframe"
        ? `${embed.src}${embed.src.includes("?") ? "&" : "?"}autoplay=1&mute=1&muted=1`
        : embed?.src;
    return (
      <div
        className={cx(
          "relative mx-auto aspect-video w-full overflow-hidden bg-black",
          { md: "max-w-2xl", lg: "max-w-4xl", full: "max-w-none" }[p.maxWidth],
          p.shadow && "shadow-[0_30px_80px_-30px_rgba(0,0,0,.55)]",
        )}
        style={{ borderRadius: p.rounded ? "var(--zf-radius)" : 0 }}
      >
        {!embed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-zinc-800 to-zinc-950 text-white/80">
            <span className="flex size-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
              <PlayIcon className="ml-1 size-7 fill-current" />
            </span>
            <span className="text-sm">Paste a YouTube, Vimeo or MP4 link</span>
          </div>
        ) : embed.kind === "video" ? (
          <video
            src={src}
            className="absolute inset-0 size-full"
            controls
            playsInline
            muted={p.autoplay}
            autoPlay={p.autoplay}
            preload="metadata"
          />
        ) : (
          <iframe
            src={src}
            className="absolute inset-0 size-full"
            title="Video"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
          />
        )}
      </div>
    );
  },
};

const LIST_ICONS = { check: CheckIcon, arrow: ChevronRightIcon, dot: CircleIcon, x: XIcon, star: StarIcon };
export type ChecklistProps = {
  items: { text: string }[];
  icon: keyof typeof LIST_ICONS;
  columns: "1" | "2";
  size: "md" | "lg";
};
export const Checklist: ComponentConfig<ChecklistProps> = {
  label: "Checklist",
  fields: {
    items: {
      type: "array",
      label: "Items",
      arrayFields: { text: { type: "text", label: "Text", contentEditable: true } },
      defaultItemProps: { text: "Another benefit" },
      getItemSummary: (item) => item.text || "Item",
    },
    icon: {
      type: "select",
      label: "Icon",
      options: [
        { label: "Check", value: "check" },
        { label: "Arrow", value: "arrow" },
        { label: "Dot", value: "dot" },
        { label: "Star", value: "star" },
        { label: "Cross (for “not for you”)", value: "x" },
      ],
    },
    columns: {
      type: "radio",
      label: "Columns",
      options: [
        { label: "1", value: "1" },
        { label: "2", value: "2" },
      ],
    },
    size: {
      type: "radio",
      label: "Size",
      options: [
        { label: "M", value: "md" },
        { label: "L", value: "lg" },
      ],
    },
  },
  defaultProps: {
    items: [
      { text: "Step-by-step video lessons" },
      { text: "Templates you can copy today" },
      { text: "Lifetime access & updates" },
    ],
    icon: "check",
    columns: "1",
    size: "lg",
  },
  render: ({ items, icon, columns, size }) => {
    const Icon = LIST_ICONS[icon] ?? CheckIcon;
    return (
      <ul
        className={cx(
          "zf-checklist grid w-fit max-w-full gap-x-8 gap-y-3 text-left",
          columns === "2" && "md:grid-cols-2",
          size === "lg" ? "text-lg" : "text-base",
        )}
      >
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className="mt-[0.2em] flex size-[1.35em] shrink-0 items-center justify-center rounded-full"
              style={{
                background:
                  icon === "x" ? "rgba(239,68,68,.12)" : "color-mix(in srgb, var(--zf-primary) 14%, transparent)",
                color: icon === "x" ? "#ef4444" : "var(--zf-primary)",
              }}
            >
              <Icon
                className={cx("size-[0.8em]", icon === "dot" && "fill-current", icon === "star" && "fill-current")}
                strokeWidth={3}
              />
            </span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    );
  },
};
