import type { Config, Data } from "@puckeditor/core";
import { colorField } from "./fields";
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
import { Countdown, OptInForm, type CountdownProps, type OptInFormProps } from "./components/interactive";
import { OrderForm, UpsellOffer, type OrderFormProps, type UpsellOfferProps } from "./components/checkout";
import { DEFAULT_THEME, FONTS, RADII, THEME_PRESETS, themeVars, type PageTheme } from "./theme";

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

const fontOptions = Object.entries(FONTS).map(([value, f]) => ({ label: f.label, value }));
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
    conversion: { title: "Conversion", components: ["OptInForm", "Countdown", "Pricing", "Guarantee", "ProgressBar"] },
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
      headingFont: { type: "select", label: "Heading font", options: fontOptions },
      bodyFont: { type: "select", label: "Body font", options: fontOptions },
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
    render: ({ children, ...props }) => (
      <div
        className="zf-page flex min-h-full w-full flex-col antialiased"
        style={{
          ...themeVars(props as Partial<PageTheme>),
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
    CustomHtml,
    OrderForm,
    UpsellOffer,
  },
};

/** A fresh page: one hero section, so new users never face a blank canvas. */
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
