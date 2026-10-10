import type { ComponentConfig } from "@puckeditor/core";
import {
  AwardIcon,
  BarChart3Icon,
  CheckIcon,
  ClockIcon,
  GiftIcon,
  HeartIcon,
  LockIcon,
  RocketIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  TargetIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { safeUrl } from "./content";
import { getRuntime } from "../runtime";
import { cx } from "../utils";

export const ICONS = {
  sparkles: SparklesIcon,
  zap: ZapIcon,
  rocket: RocketIcon,
  target: TargetIcon,
  chart: BarChart3Icon,
  users: UsersIcon,
  shield: ShieldCheckIcon,
  clock: ClockIcon,
  gift: GiftIcon,
  heart: HeartIcon,
  award: AwardIcon,
  lock: LockIcon,
} as const;
const iconOptions = Object.keys(ICONS).map((k) => ({ label: k[0]!.toUpperCase() + k.slice(1), value: k }));

const card =
  "rounded-[var(--zf-radius)] border border-[color-mix(in_srgb,var(--zf-fg)_10%,transparent)] bg-[color-mix(in_srgb,var(--zf-fg)_3%,var(--zf-bg))]";

export type FeaturesProps = {
  items: { icon: keyof typeof ICONS; title: string; text: string }[];
  columns: "2" | "3" | "4";
  style: "cards" | "plain";
  align: "left" | "center";
};
export const Features: ComponentConfig<FeaturesProps> = {
  label: "Feature grid",
  fields: {
    items: {
      type: "array",
      label: "Features",
      arrayFields: {
        icon: { type: "select", label: "Icon", options: iconOptions },
        title: { type: "text", label: "Title" },
        text: { type: "textarea", label: "Text" },
      },
      defaultItemProps: { icon: "sparkles", title: "Feature", text: "Describe the benefit in one or two lines." },
      getItemSummary: (i) => i.title || "Feature",
    },
    columns: {
      type: "radio",
      label: "Columns",
      options: [
        { label: "2", value: "2" },
        { label: "3", value: "3" },
        { label: "4", value: "4" },
      ],
    },
    style: {
      type: "radio",
      label: "Style",
      options: [
        { label: "Cards", value: "cards" },
        { label: "Plain", value: "plain" },
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
  },
  defaultProps: {
    items: [
      { icon: "zap", title: "Launch in days", text: "Proven templates so you never start from a blank page." },
      { icon: "target", title: "Built to convert", text: "Every section follows what top funnels already do." },
      { icon: "chart", title: "Know your numbers", text: "See exactly which step makes you money." },
    ],
    columns: "3",
    style: "cards",
    align: "left",
  },
  render: ({ items, columns, style, align }) => (
    <div
      className={cx(
        "grid w-full gap-5",
        { "2": "md:grid-cols-2", "3": "md:grid-cols-3", "4": "md:grid-cols-2 lg:grid-cols-4" }[columns],
        align === "center" ? "text-center" : "text-left",
      )}
    >
      {items.map((item, i) => {
        const Icon = ICONS[item.icon] ?? SparklesIcon;
        return (
          <div
            key={i}
            className={cx(
              "flex flex-col gap-3",
              style === "cards" && cx(card, "p-6"),
              align === "center" && "items-center",
            )}
          >
            <span
              className="flex size-11 items-center justify-center rounded-xl"
              style={{
                background: "color-mix(in srgb, var(--zf-primary) 14%, transparent)",
                color: "var(--zf-primary)",
              }}
            >
              <Icon className="size-5" />
            </span>
            <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--zf-heading-font)" }}>
              {item.title}
            </h3>
            <p className="leading-relaxed" style={{ color: "color-mix(in srgb, var(--zf-fg) 70%, transparent)" }}>
              {item.text}
            </p>
          </div>
        );
      })}
    </div>
  ),
};

export type TestimonialsProps = {
  items: { quote: string; name: string; role: string; avatar: string }[];
  layout: "grid" | "single";
  stars: boolean;
};
function Avatar({ name, src }: { name: string; src: string }) {
  if (src)
    // eslint-disable-next-line @next/next/no-img-element -- published pages use plain <img>
    return <img src={src} alt={name} loading="lazy" className="size-11 rounded-full object-cover" />;
  return (
    <span
      className="flex size-11 items-center justify-center rounded-full text-sm font-semibold"
      style={{ background: "color-mix(in srgb, var(--zf-primary) 16%, transparent)", color: "var(--zf-primary)" }}
    >
      {name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()}
    </span>
  );
}
export const Testimonials: ComponentConfig<TestimonialsProps> = {
  label: "Testimonials",
  fields: {
    items: {
      type: "array",
      label: "Testimonials",
      arrayFields: {
        quote: { type: "textarea", label: "Quote" },
        name: { type: "text", label: "Name" },
        role: { type: "text", label: "Role / result" },
        avatar: { type: "text", label: "Photo URL (optional)" },
      },
      defaultItemProps: {
        quote: "This changed how I run my business.",
        name: "Alex Morgan",
        role: "Coach",
        avatar: "",
      },
      getItemSummary: (i) => i.name || "Testimonial",
    },
    layout: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "Grid", value: "grid" },
        { label: "Featured", value: "single" },
      ],
    },
    stars: {
      type: "radio",
      label: "5-star rating",
      options: [
        { label: "Hide", value: false },
        { label: "Show", value: true },
      ],
    },
  },
  defaultProps: {
    items: [
      {
        quote: "I made back the investment in the first week. The templates alone are worth it.",
        name: "Sarah Klein",
        role: "Online coach",
        avatar: "",
      },
      {
        quote: "Finally a funnel that looks premium without hiring a designer.",
        name: "Marcus Lee",
        role: "Agency owner",
        avatar: "",
      },
      {
        quote: "Our checkout conversion went from 2.1% to 4.8% in a month.",
        name: "Priya Shah",
        role: "E-commerce founder",
        avatar: "",
      },
    ],
    layout: "grid",
    stars: true,
  },
  render: ({ items, layout, stars }) => {
    const list = layout === "single" ? items.slice(0, 1) : items;
    return (
      <div className={cx("grid w-full gap-5 text-left", layout === "grid" ? "md:grid-cols-3" : "mx-auto max-w-3xl")}>
        {list.map((t, i) => (
          <figure key={i} className={cx(card, "flex flex-col gap-5 p-6", layout === "single" && "p-8 md:p-10")}>
            {stars && (
              <div className="flex gap-0.5 text-amber-400" aria-label="5 out of 5 stars">
                {Array.from({ length: 5 }, (_, s) => (
                  <StarIcon key={s} className="size-4 fill-current" />
                ))}
              </div>
            )}
            <blockquote
              className={cx("flex-1 leading-relaxed", layout === "single" ? "text-xl md:text-2xl" : "text-[15px]")}
            >
              “{t.quote}”
            </blockquote>
            <figcaption className="flex items-center gap-3">
              <Avatar name={t.name} src={t.avatar} />
              <span>
                <span className="block font-semibold">{t.name}</span>
                <span className="block text-sm" style={{ color: "color-mix(in srgb, var(--zf-fg) 60%, transparent)" }}>
                  {t.role}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    );
  },
};

export type FaqProps = { items: { question: string; answer: string }[] };
export const Faq: ComponentConfig<FaqProps> = {
  label: "FAQ",
  fields: {
    items: {
      type: "array",
      label: "Questions",
      arrayFields: { question: { type: "text", label: "Question" }, answer: { type: "textarea", label: "Answer" } },
      defaultItemProps: { question: "New question?", answer: "Answer it clearly and remove the objection." },
      getItemSummary: (i) => i.question || "Question",
    },
  },
  defaultProps: {
    items: [
      {
        question: "How long do I have access?",
        answer: "Forever. You get lifetime access including all future updates.",
      },
      {
        question: "Is there a guarantee?",
        answer: "Yes. If it's not for you, email us within 30 days for a full refund.",
      },
      {
        question: "Do I need any experience?",
        answer: "No. Everything is explained step by step, starting from zero.",
      },
    ],
  },
  render: ({ items }) => (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 text-left">
      {items.map((item, i) => (
        <details key={i} className={cx(card, "group px-5 py-4 [&_summary::-webkit-details-marker]:hidden")}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold">
            {item.question}
            <span
              className="flex size-7 shrink-0 items-center justify-center rounded-full text-lg leading-none transition-transform group-open:rotate-45"
              style={{
                background: "color-mix(in srgb, var(--zf-primary) 12%, transparent)",
                color: "var(--zf-primary)",
              }}
              aria-hidden
            >
              +
            </span>
          </summary>
          <p className="pt-3 leading-relaxed" style={{ color: "color-mix(in srgb, var(--zf-fg) 72%, transparent)" }}>
            {item.answer}
          </p>
        </details>
      ))}
    </div>
  ),
};

export type PricingProps = {
  plans: {
    name: string;
    price: string;
    period: string;
    description: string;
    features: string;
    cta: string;
    highlighted: boolean;
  }[];
};
export const Pricing: ComponentConfig<PricingProps> = {
  label: "Pricing table",
  fields: {
    plans: {
      type: "array",
      label: "Plans",
      arrayFields: {
        name: { type: "text", label: "Name" },
        price: { type: "text", label: "Price" },
        period: { type: "text", label: "Period (e.g. /month)" },
        description: { type: "text", label: "Short description" },
        features: { type: "textarea", label: "Features (one per line)" },
        cta: { type: "text", label: "Button label" },
        highlighted: {
          type: "radio",
          label: "Most popular",
          options: [
            { label: "No", value: false },
            { label: "Yes", value: true },
          ],
        },
      },
      defaultItemProps: {
        name: "Plan",
        price: "$49",
        period: "",
        description: "",
        features: "Feature",
        cta: "Get started",
        highlighted: false,
      },
      getItemSummary: (i) => i.name || "Plan",
    },
  },
  defaultProps: {
    plans: [
      {
        name: "Starter",
        price: "$47",
        period: "",
        description: "Everything to get going",
        features: "Core course\nWorkbook\nCommunity access",
        cta: "Get Starter",
        highlighted: false,
      },
      {
        name: "Pro",
        price: "$197",
        period: "",
        description: "Our most popular package",
        features: "Everything in Starter\nDone-for-you templates\nMonthly live Q&A\nPriority support",
        cta: "Get Pro",
        highlighted: true,
      },
    ],
  },
  render: ({ plans, puck }) => {
    const next = getRuntime(puck.metadata).nextUrl ?? "#";
    return (
      <div
        className={cx(
          "mx-auto grid w-full gap-6 text-left",
          plans.length >= 3 ? "max-w-6xl md:grid-cols-3" : "max-w-4xl md:grid-cols-2",
        )}
      >
        {plans.map((p, i) => (
          <div
            key={i}
            className={cx(card, "relative flex flex-col gap-5 p-7", p.highlighted && "md:-my-3 md:py-10")}
            style={
              p.highlighted
                ? {
                    borderColor: "var(--zf-primary)",
                    boxShadow: "0 30px 60px -30px color-mix(in srgb, var(--zf-primary) 55%, transparent)",
                  }
                : undefined
            }
          >
            {p.highlighted && (
              <span
                className="absolute -top-3 left-7 rounded-full px-3 py-1 text-xs font-semibold"
                style={{ background: "var(--zf-primary)", color: "var(--zf-on-primary)" }}
              >
                Most popular
              </span>
            )}
            <div>
              <h3 className="text-lg font-semibold" style={{ fontFamily: "var(--zf-heading-font)" }}>
                {p.name}
              </h3>
              {p.description && (
                <p className="text-sm" style={{ color: "color-mix(in srgb, var(--zf-fg) 60%, transparent)" }}>
                  {p.description}
                </p>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-extrabold tracking-tight" style={{ fontFamily: "var(--zf-heading-font)" }}>
                {p.price}
              </span>
              {p.period && (
                <span style={{ color: "color-mix(in srgb, var(--zf-fg) 60%, transparent)" }}>{p.period}</span>
              )}
            </div>
            <ul className="flex flex-1 flex-col gap-2.5">
              {p.features
                .split("\n")
                .filter(Boolean)
                .map((f, j) => (
                  <li key={j} className="flex items-start gap-2.5">
                    <CheckIcon
                      className="mt-0.5 size-4 shrink-0"
                      style={{ color: "var(--zf-primary)" }}
                      strokeWidth={3}
                    />
                    {f}
                  </li>
                ))}
            </ul>
            <a
              href={next}
              className="inline-flex min-h-12 items-center justify-center px-6 font-semibold transition-transform hover:-translate-y-0.5"
              style={{
                borderRadius: "var(--zf-btn-radius)",
                ...(p.highlighted
                  ? { background: "var(--zf-primary)", color: "var(--zf-on-primary)" }
                  : { border: "1.5px solid color-mix(in srgb, var(--zf-fg) 20%, transparent)" }),
              }}
            >
              {p.cta}
            </a>
          </div>
        ))}
      </div>
    );
  },
};

export type LogoBarProps = { title: string; logos: { name: string; image: string }[] };
export const LogoBar: ComponentConfig<LogoBarProps> = {
  label: "Logo bar",
  fields: {
    title: { type: "text", label: "Title" },
    logos: {
      type: "array",
      label: "Logos",
      arrayFields: { name: { type: "text", label: "Name" }, image: { type: "text", label: "Logo URL (optional)" } },
      defaultItemProps: { name: "Brand", image: "" },
      getItemSummary: (i) => i.name || "Logo",
    },
  },
  defaultProps: {
    title: "As featured in",
    logos: [
      { name: "Forbes", image: "" },
      { name: "Inc.", image: "" },
      { name: "Entrepreneur", image: "" },
      { name: "TechCrunch", image: "" },
    ],
  },
  render: ({ title, logos }) => (
    <div className="flex w-full flex-col items-center gap-5">
      {title && (
        <p
          className="text-xs font-semibold tracking-[0.2em] uppercase"
          style={{ color: "color-mix(in srgb, var(--zf-fg) 50%, transparent)" }}
        >
          {title}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-60 grayscale">
        {logos.map((l, i) =>
          l.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- published pages use plain <img>
            <img key={i} src={l.image} alt={l.name} className="h-7 w-auto object-contain" loading="lazy" />
          ) : (
            <span key={i} className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--zf-heading-font)" }}>
              {l.name}
            </span>
          ),
        )}
      </div>
    </div>
  ),
};

export type GuaranteeProps = { days: number; title: string; text: string };
export const Guarantee: ComponentConfig<GuaranteeProps> = {
  label: "Guarantee",
  fields: {
    days: { type: "number", label: "Days", min: 1, max: 365 },
    title: { type: "text", label: "Title" },
    text: { type: "textarea", label: "Text" },
  },
  defaultProps: {
    days: 30,
    title: "100% money-back guarantee",
    text: "Try it risk-free. If you're not happy within 30 days, email us and we'll refund every cent. No questions asked.",
  },
  render: ({ days, title, text }) => (
    <div
      className={cx(
        card,
        "mx-auto flex w-full max-w-3xl flex-col items-center gap-5 p-6 text-center sm:flex-row sm:text-left",
      )}
    >
      <div
        className="flex size-24 shrink-0 flex-col items-center justify-center rounded-full border-4 border-double"
        style={{ borderColor: "var(--zf-primary)", color: "var(--zf-primary)" }}
      >
        <span className="text-3xl leading-none font-extrabold">{days}</span>
        <span className="text-[10px] font-bold tracking-widest uppercase">days</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <h3 className="text-xl font-bold" style={{ fontFamily: "var(--zf-heading-font)" }}>
          {title}
        </h3>
        <p style={{ color: "color-mix(in srgb, var(--zf-fg) 70%, transparent)" }}>{text}</p>
      </div>
    </div>
  ),
};

export type StatsProps = { items: { value: string; label: string }[] };
export const Stats: ComponentConfig<StatsProps> = {
  label: "Stats",
  fields: {
    items: {
      type: "array",
      label: "Stats",
      arrayFields: { value: { type: "text", label: "Value" }, label: { type: "text", label: "Label" } },
      defaultItemProps: { value: "10k+", label: "Customers" },
      getItemSummary: (i) => i.value || "Stat",
    },
  },
  defaultProps: {
    items: [
      { value: "12,400+", label: "Students" },
      { value: "4.9/5", label: "Average rating" },
      { value: "$2.3M", label: "Earned by members" },
    ],
  },
  render: ({ items }) => (
    <div
      className={cx(
        "grid w-full gap-6",
        items.length >= 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 sm:grid-cols-3",
      )}
    >
      {items.map((s, i) => (
        <div key={i} className="flex flex-col items-center gap-1 text-center">
          <span
            className="text-4xl font-extrabold tracking-tight md:text-5xl"
            style={{ fontFamily: "var(--zf-heading-font)", color: "var(--zf-primary)" }}
          >
            {s.value}
          </span>
          <span className="text-sm font-medium" style={{ color: "color-mix(in srgb, var(--zf-fg) 60%, transparent)" }}>
            {s.label}
          </span>
        </div>
      ))}
    </div>
  ),
};

export type ProgressBarProps = { percent: number; label: string };
export const ProgressBar: ComponentConfig<ProgressBarProps> = {
  label: "Progress bar",
  fields: { label: { type: "text", label: "Label" }, percent: { type: "number", label: "Percent", min: 0, max: 100 } },
  defaultProps: { label: "Step 1 of 2: almost done!", percent: 50 },
  render: ({ percent, label }) => (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-2">
      <div
        className="h-3 w-full overflow-hidden rounded-full"
        style={{ background: "color-mix(in srgb, var(--zf-fg) 10%, transparent)" }}
      >
        <div
          className="h-full rounded-full bg-[length:24px_24px]"
          style={{
            width: `${Math.max(0, Math.min(100, percent))}%`,
            backgroundColor: "var(--zf-primary)",
            backgroundImage:
              "linear-gradient(45deg, rgba(255,255,255,.18) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.18) 50%, rgba(255,255,255,.18) 75%, transparent 75%)",
          }}
        />
      </div>
      {label && <p className="text-center text-sm font-medium">{label}</p>}
    </div>
  ),
};

export type CustomHtmlProps = { html: string };
export const CustomHtml: ComponentConfig<CustomHtmlProps> = {
  label: "Custom HTML",
  fields: { html: { type: "textarea", label: "HTML (scripts run on the published page only)" } },
  defaultProps: { html: "" },
  render: ({ html, puck }) =>
    puck.isEditing ? (
      <div
        className="w-full rounded-lg border border-dashed p-4 text-left font-mono text-xs"
        style={{
          borderColor: "color-mix(in srgb, var(--zf-fg) 25%, transparent)",
          color: "color-mix(in srgb, var(--zf-fg) 60%, transparent)",
        }}
      >
        {html ? `${html.slice(0, 160)}${html.length > 160 ? "…" : ""}` : "Custom HTML: paste embed code in the sidebar"}
      </div>
    ) : (
      <div className="w-full" dangerouslySetInnerHTML={{ __html: html }} />
    ),
};

export { safeUrl };
