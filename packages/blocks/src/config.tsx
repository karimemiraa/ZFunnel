import type { Config, Data } from "@puckeditor/core";
import type { Locale } from "@zfunnel/i18n";
import { AR_DEFAULTS } from "./defaults-ar";
import { colorField, fontField, type FontOption } from "./fields";
import {
  Columns,
  Divider,
  Section,
  Spacer,
  type ColumnsProps,
  type DividerProps,
  type SectionProps,
  type SpacerProps,
} from "./components/layout";
import {
  Badge,
  Button,
  Checklist,
  Heading,
  Image,
  Text,
  Video,
  type BadgeProps,
  type ButtonProps,
  type ChecklistProps,
  type HeadingProps,
  type ImageProps,
  type TextProps,
  type VideoProps,
} from "./components/content";
import {
  CustomHtml,
  Faq,
  Features,
  Guarantee,
  LogoBar,
  Pricing,
  ProgressBar,
  Stats,
  Testimonials,
  type CustomHtmlProps,
  type FaqProps,
  type FeaturesProps,
  type GuaranteeProps,
  type LogoBarProps,
  type PricingProps,
  type ProgressBarProps,
  type StatsProps,
  type TestimonialsProps,
} from "./components/marketing";
import {
  Countdown,
  OptInForm,
  Survey,
  type CountdownProps,
  type OptInFormProps,
  type SurveyProps,
} from "./components/interactive";
import { OrderForm, UpsellOffer, type OrderFormProps, type UpsellOfferProps } from "./components/checkout";
import {
  ARABIC_FONTS,
  DEFAULT_THEME,
  FONTS,
  fontStack,
  RADII,
  THEME_PRESETS,
  themeVars,
  type ArabicFontChoice,
  type FontKey,
  type PageTheme,
} from "./theme";
import { getRuntime } from "./runtime";

export type Components = {
  Section: SectionProps;
  Columns: ColumnsProps;
  Spacer: SpacerProps;
  Divider: DividerProps;
  Heading: HeadingProps;
  Text: TextProps;
  Badge: BadgeProps;
  Button: ButtonProps;
  Image: ImageProps;
  Video: VideoProps;
  Checklist: ChecklistProps;
  Features: FeaturesProps;
  Testimonials: TestimonialsProps;
  Faq: FaqProps;
  Pricing: PricingProps;
  LogoBar: LogoBarProps;
  Guarantee: GuaranteeProps;
  Stats: StatsProps;
  ProgressBar: ProgressBarProps;
  Countdown: CountdownProps;
  OptInForm: OptInFormProps;
  Survey: SurveyProps;
  CustomHtml: CustomHtmlProps;
  OrderForm: OrderFormProps;
  UpsellOffer: UpsellOfferProps;
};

export type RootProps = PageTheme & {
  preset: string;
  title: string;
  seoDescription: string;
  ogImage: string;
};

export type PageData = Data<Components, RootProps>;

/** Latin font options; on Arabic sites each previews with its Arabic pair, as the page will render it. */
const latinFontOptions = (lang: Locale): FontOption[] =>
  Object.entries(FONTS).map(([value, f]) => ({
    value,
    label: f.label,
    hint: `+ ${ARABIC_FONTS[f.arabic].label}`,
    family: fontStack(value, "auto", lang),
  }));
const arabicFontOptions: FontOption[] = [
  { value: "auto", label: "Auto (paired with the Latin font)", family: ARABIC_FONTS.noto.family },
  ...Object.entries(ARABIC_FONTS).map(([value, f]) => ({ value, label: f.label, family: f.family })),
];
const fontFields = (lang: Locale) => {
  const latin = latinFontOptions(lang);
  const sampleLang = lang === "ar" ? "ar" : "en";
  return {
    headingFont: fontField<FontKey>("Heading font", latin, sampleLang),
    bodyFont: fontField<FontKey>("Body font", latin, sampleLang),
    arabicHeadingFont: fontField<ArabicFontChoice>("Arabic heading font", arabicFontOptions, "ar"),
    arabicBodyFont: fontField<ArabicFontChoice>("Arabic body font", arabicFontOptions, "ar"),
  };
};
const radiusOptions = Object.keys(RADII).map((value) => ({
  label: value === "full" ? "Pill" : value.toUpperCase(),
  value,
}));

export const config: Config<{
  components: Components;
  root: RootProps;
  categories: ["layout", "content", "checkout", "conversion", "proof", "advanced"];
}> = {
  categories: {
    layout: { title: "Layout", components: ["Section", "Columns", "Spacer", "Divider"] },
    content: { title: "Content", components: ["Heading", "Text", "Badge", "Button", "Image", "Video", "Checklist"] },
    checkout: { title: "Checkout", components: ["OrderForm", "UpsellOffer"] },
    conversion: {
      title: "Conversion",
      components: ["OptInForm", "Survey", "Countdown", "Pricing", "Guarantee", "ProgressBar"],
    },
    proof: { title: "Social proof", components: ["Testimonials", "Stats", "LogoBar", "Features", "Faq"] },
    advanced: { title: "Advanced", components: ["CustomHtml"], defaultExpanded: false },
  },
  root: {
    fields: {
      title: { type: "text", label: "Page title (browser tab & SEO)" },
      seoDescription: { type: "textarea", label: "SEO description" },
      ogImage: { type: "text", label: "Social share image URL" },
      preset: {
        type: "select",
        label: "Color preset",
        options: [{ label: "Custom", value: "" }, ...THEME_PRESETS.map((p) => ({ label: p.name, value: p.name }))],
      },
      primary: colorField("Brand color"),
      background: colorField("Page background"),
      text: colorField("Text color"),
      ...fontFields("en"),
      radius: { type: "select", label: "Corner radius", options: radiusOptions },
      buttonRadius: { type: "select", label: "Button shape", options: radiusOptions },
    },
    defaultProps: { ...DEFAULT_THEME, preset: "Indigo", title: "", seoDescription: "", ogImage: "" },
    // Picking a preset fills in the colours; editing a colour switches back to "Custom".
    resolveData: (data, { changed }) => {
      if (!data.props) return data;
      const preset = THEME_PRESETS.find((p) => p.name === data.props!.preset);
      if (changed.preset && preset) return { ...data, props: { ...data.props, ...preset.theme } };
      if ((changed.primary || changed.background || changed.text) && preset)
        return { ...data, props: { ...data.props, preset: "" } };
      return data;
    },
    render: ({ children, puck, ...props }) => (
      <div
        className="zf-page flex min-h-full w-full flex-col antialiased"
        style={{
          ...themeVars(props as Partial<PageTheme>, getRuntime(puck?.metadata).lang),
          background: "var(--zf-bg)",
          color: "var(--zf-fg)",
          fontFamily: "var(--zf-body-font)",
        }}
      >
        {children}
      </div>
    ),
  },
  components: {
    Section,
    Columns,
    Spacer,
    Divider,
    Heading,
    Text,
    Badge,
    Button,
    Image,
    Video,
    Checklist,
    Features,
    Testimonials,
    Faq,
    Pricing,
    LogoBar,
    Guarantee,
    Stats,
    ProgressBar,
    Countdown,
    OptInForm,
    Survey,
    CustomHtml,
    OrderForm,
    UpsellOffer,
  },
};

/** A fresh page: one hero section, so new users never face a blank canvas. */
/**
 * The block config for a site language: Arabic sites get natively written default text, so newly
 * added blocks start in Arabic (ADR-023). Same components, fields and rendering otherwise.
 */
export function configFor(lang: Locale = "en"): typeof config {
  if (lang !== "ar") return config;
  if (arConfig) return arConfig;
  const components = Object.fromEntries(
    Object.entries(config.components).map(([name, c]) => [
      name,
      AR_DEFAULTS[name] ? { ...c, defaultProps: { ...c.defaultProps, ...AR_DEFAULTS[name] } } : c,
    ]),
  ) as typeof config.components;
  const root = { ...config.root, fields: { ...config.root!.fields, ...fontFields("ar") } } as typeof config.root;
  const built: typeof config = { ...config, root, components };
  arConfig = built;
  return built;
}
let arConfig: typeof config | null = null;

export function emptyPage(title = ""): PageData {
  return {
    root: { props: { ...DEFAULT_THEME, preset: "Indigo", title, seoDescription: "", ogImage: "" } },
    content: [
      {
        type: "Section",
        props: {
          id: "Section-hero",
          ...Section.defaultProps!,
          background: "gradient",
          content: [
            { type: "Heading", props: { id: "Heading-hero", ...Heading.defaultProps!, size: "display", level: "h1" } },
            { type: "Text", props: { id: "Text-hero", ...Text.defaultProps! } },
            { type: "Button", props: { id: "Button-hero", ...Button.defaultProps! } },
          ],
        },
      },
    ],
  } as PageData;
}
