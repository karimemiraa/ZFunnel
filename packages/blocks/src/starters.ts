import type { ComponentData } from "@puckeditor/core";
import { config, type Components, type PageData, type RootProps } from "./config";
import { DEFAULT_THEME, type PageTheme } from "./theme";

type BlockType = keyof Components;
type Node = ComponentData;

let counter = 0;
function uid() {
  counter = (counter + 1) % 1e6;
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Builds a block with its defaults, overridden by `props`. */
export function block<T extends BlockType>(type: T, props: Partial<Components[T]> = {}): Node {
  const defaults = (config.components[type].defaultProps ?? {}) as Components[T];
  return { type, props: { ...defaults, ...props, id: `${type}-${uid()}` } } as Node;
}

export function section(props: Partial<Components["Section"]>, content: Node[]): Node {
  return block("Section", { ...props, content: content as never });
}

export function columns(props: Partial<Components["Columns"]>, cols: Node[][]): Node {
  const [c1 = [], c2 = [], c3 = [], c4 = []] = cols;
  return block("Columns", { ...props, c1: c1 as never, c2: c2 as never, c3: c3 as never, c4: c4 as never });
}

export function page(title: string, content: Node[], theme: Partial<PageTheme & { preset: string }> = {}): PageData {
  const root: RootProps = { ...DEFAULT_THEME, preset: "Indigo", title, seoDescription: "", ogImage: "", ...theme };
  return { root: { props: root }, content } as PageData;
}

const text = (html: string, extra: Partial<Components["Text"]> = {}) => block("Text", { text: html, ...extra });

export type StarterStepType = "optin" | "sales" | "checkout" | "upsell" | "downsell" | "thankyou" | "page";

/** A polished starting page for each step type. */
export function starterPage(
  type: StarterStepType,
  name: string,
  theme?: Partial<PageTheme & { preset: string }>,
): PageData {
  switch (type) {
    case "optin":
      return page(
        name,
        [
          section({ background: "gradient", padding: "xl", width: "narrow" }, [
            block("Badge", { text: "Free guide", icon: "star" }),
            block("Heading", {
              text: "Get the 7-step playbook to double your leads",
              highlight: "double your leads",
              level: "h1",
              size: "display",
            }),
            text("<p>The exact system we use to turn cold traffic into booked calls, free for a limited time.</p>"),
            block("OptInForm", {}),
          ]),
          section({ background: "subtle", padding: "md" }, [block("LogoBar", {})]),
        ],
        theme,
      );
    case "sales":
      return page(
        name,
        [
          section({ background: "gradient", padding: "xl" }, [
            block("Badge", { text: "Doors close soon", icon: "dot" }),
            block("Heading", {
              text: "The complete system to launch your offer in 30 days",
              highlight: "30 days",
              level: "h1",
              size: "display",
            }),
            text("<p>Everything you need, from idea to first sale, without the guesswork.</p>", { size: "xl" }),
            block("Video", {}),
            block("Button", { label: "Get instant access", sublabel: "30-day money-back guarantee", size: "xl" }),
          ]),
          section({ padding: "lg" }, [block("Heading", { text: "What you get", size: "lg" }), block("Features", {})]),
          section({ background: "subtle", padding: "lg" }, [
            block("Heading", { text: "Loved by thousands of creators", size: "lg" }),
            block("Testimonials", {}),
            block("Stats", {}),
          ]),
          section({ padding: "lg", width: "narrow" }, [
            block("Guarantee", {}),
            block("Button", { label: "Yes, I'm in", size: "xl" }),
          ]),
          section({ background: "subtle", padding: "lg" }, [
            block("Heading", { text: "Questions?", size: "lg" }),
            block("Faq", {}),
          ]),
        ],
        theme,
      );
    case "checkout":
      return page(
        name,
        [
          section({ background: "subtle", padding: "lg" }, [
            block("ProgressBar", { percent: 90, label: "Almost done: complete your order" }),
            columns({ ratio: "wide-left", valign: "top", reverseOnMobile: true }, [
              [block("Heading", { text: "Complete your order", size: "md", align: "left" }), block("OrderForm", {})],
              [
                block("Heading", { text: "Here's what you get", size: "sm", align: "left" }),
                block("Checklist", {}),
                block("Guarantee", {}),
              ],
            ]),
          ]),
        ],
        theme,
      );
    case "upsell":
    case "downsell":
      return page(
        name,
        [
          section({ background: "primary", padding: "sm" }, [
            text(
              type === "upsell"
                ? "<p><strong>Wait! Your order is not complete yet.</strong></p>"
                : "<p><strong>Hold on: here's a lighter option.</strong></p>",
              {
                size: "md",
                muted: false,
              },
            ),
          ]),
          section({ padding: "xl", width: "narrow" }, [
            block("Heading", {
              text: type === "upsell" ? "Add the done-for-you templates for 60% off" : "Get just the templates for $27",
              highlight: type === "upsell" ? "60% off" : "$27",
              level: "h1",
              size: "xl",
            }),
            block("Video", {}),
            block("Checklist", {}),
            block("Countdown", { minutes: 10 }),
            block("UpsellOffer", {}),
          ]),
        ],
        theme,
      );
    case "thankyou":
      return page(
        name,
        [
          section({ background: "gradient", padding: "xl", width: "narrow" }, [
            block("Badge", { text: "You're in", icon: "star", style: "solid" }),
            block("Heading", {
              text: "Thank you! Check your inbox",
              highlight: "Check your inbox",
              level: "h1",
              size: "xl",
            }),
            text("<p>We've sent everything to your email. While you wait, here's your next step.</p>"),
            block("Video", {}),
          ]),
        ],
        theme,
      );
    default:
      return page(
        name,
        [
          section({ background: "gradient", padding: "xl" }, [
            block("Heading", { level: "h1", size: "display" }),
            text("<p>Start building your page.</p>"),
            block("Button", {}),
          ]),
        ],
        theme,
      );
  }
}
