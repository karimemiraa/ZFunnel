import type { PageData } from "./config";
import { block, columns, page, section, starterPage, type StarterStepType } from "./starters";
import type { PageTheme } from "./theme";

type Theme = Partial<PageTheme & { preset: string }>;
type StepSpec = { name: string; type: StarterStepType; build?: (t: Theme) => PageData };
export type FunnelTemplate = {
  id: string;
  name: string;
  category: "Leads" | "Sales" | "Events" | "Services";
  description: string;
  theme: Theme;
  steps: StepSpec[];
};

const text = (html: string, extra: Record<string, unknown> = {}) => block("Text", { text: html, ...extra });
const thanks = (name: string, headline: string, body: string) => (t: Theme) =>
  page(
    name,
    [
      section({ background: "gradient", padding: "xl", width: "narrow" }, [
        block("Badge", { text: "Confirmed", icon: "star", style: "solid" }),
        block("Heading", { text: headline, level: "h1", size: "xl" }),
        text(`<p>${body}</p>`),
        block("Video", {}),
      ]),
    ],
    t,
  );

export const TEMPLATES: FunnelTemplate[] = [
  {
    id: "quiz",
    name: "Quiz funnel",
    category: "Leads",
    description: "A fun, one-question-at-a-time quiz that scores leads and tags them by result.",
    theme: { preset: "Rose", headingFont: "jakarta", bodyFont: "inter", buttonRadius: "full" },
    steps: [
      {
        name: "Quiz",
        type: "optin",
        build: (t) =>
          page(
            "Quiz",
            [
              section({ background: "gradient", padding: "lg", width: "narrow" }, [
                block("Badge", { text: "60-second quiz", icon: "star" }),
                block("Heading", { text: "What's holding your business back?", level: "h1", size: "xl" }),
                text("<p>Answer 3 quick questions and get a personalized plan for your next 90 days.</p>"),
                block("Survey", {
                  formName: "Growth quiz",
                  quiz: true,
                  tag: "quiz-taker",
                  buttonLabel: "Show my result",
                  questions: [
                    {
                      label: "How do you get most of your customers today?",
                      type: "single_choice",
                      required: true,
                      options: "Word of mouth | 1\nSocial media | 2\nPaid ads | 3\nA sales funnel | 4",
                      saveTo: "channel",
                    },
                    {
                      label: "How many leads do you get per week?",
                      type: "single_choice",
                      required: true,
                      options: "Fewer than 10 | 1\n10–50 | 2\n50–200 | 3\nMore than 200 | 4",
                      saveTo: "",
                    },
                    {
                      label: "What would you like to fix first?",
                      type: "single_choice",
                      required: true,
                      options: "Getting more traffic | 1\nConverting visitors | 2\nSelling more to customers | 3",
                      saveTo: "goal",
                    },
                  ],
                  outcomes: [
                    { minScore: 0, title: "The Foundation Builder", tag: "result-foundation", redirect: "" },
                    { minScore: 6, title: "The Momentum Maker", tag: "result-momentum", redirect: "" },
                    { minScore: 9, title: "The Scale Seeker", tag: "result-scale", redirect: "" },
                  ],
                }),
              ]),
            ],
            t,
          ),
      },
      {
        name: "Your plan",
        type: "thankyou",
        build: thanks(
          "Your plan",
          "Your personalized plan is on its way!",
          "We've emailed your result and a step-by-step plan. Here's a quick video to get you started.",
        ),
      },
    ],
  },
  {
    id: "lead-magnet",
    name: "Lead magnet",
    category: "Leads",
    description: "Give away a free guide and grow your email list.",
    theme: { preset: "Indigo", headingFont: "jakarta", bodyFont: "inter" },
    steps: [
      { name: "Free guide", type: "optin" },
      {
        name: "Thank you",
        type: "thankyou",
        build: thanks(
          "Thank you",
          "Your guide is on its way!",
          "Check your inbox in the next 2 minutes. Here's a quick video on how to get the most out of it.",
        ),
      },
    ],
  },
  {
    id: "webinar",
    name: "Webinar registration",
    category: "Events",
    description: "Dark, high-energy registration page with a live countdown.",
    theme: {
      preset: "Midnight",
      primary: "#a78bfa",
      background: "#0b0b14",
      text: "#f4f4f8",
      headingFont: "grotesk",
      bodyFont: "inter",
      buttonRadius: "full",
    },
    steps: [
      {
        name: "Register",
        type: "optin",
        build: (t) =>
          page(
            "Register",
            [
              section({ background: "gradient", padding: "xl", width: "narrow" }, [
                block("Badge", { text: "Free live training", icon: "dot" }),
                block("Heading", {
                  text: "How to fill your calendar with high-ticket clients in 30 days",
                  highlight: "high-ticket clients",
                  level: "h1",
                  size: "display",
                }),
                text("<p>Thursday at 7 PM CET · 60 minutes · Live Q&amp;A at the end</p>", { size: "lg" }),
                block("Countdown", { mode: "evergreen", minutes: 60 * 48 }),
                block("OptInForm", {
                  buttonLabel: "Save my free seat",
                  privacyNote: "Seats are limited to 500 people.",
                }),
              ]),
              section({ background: "subtle", padding: "lg" }, [
                block("Heading", { text: "What you'll learn", size: "lg" }),
                block("Features", {
                  items: [
                    {
                      icon: "target",
                      title: "The 3-call close",
                      text: "The simple framework that turns conversations into clients.",
                    },
                    {
                      icon: "users",
                      title: "Find buyers, not browsers",
                      text: "Where your best clients already hang out.",
                    },
                    { icon: "rocket", title: "Launch in a weekend", text: "Everything you need to start this week." },
                  ],
                }),
              ]),
            ],
            t,
          ),
      },
      {
        name: "You're registered",
        type: "thankyou",
        build: thanks(
          "You're registered",
          "You're in! Add it to your calendar",
          "We've emailed your link. Show up live for the bonus workbook.",
        ),
      },
    ],
  },
  {
    id: "book",
    name: "Free + shipping book",
    category: "Sales",
    description: "Elegant serif design for authors: book, audiobook upsell.",
    theme: {
      preset: "Gold",
      primary: "#b45309",
      background: "#fdfbf6",
      text: "#1c1a17",
      headingFont: "playfair",
      bodyFont: "inter",
      radius: "sm",
      buttonRadius: "sm",
    },
    steps: [
      {
        name: "Book offer",
        type: "sales",
        build: (t) =>
          page(
            "Book offer",
            [
              section({ padding: "xl" }, [
                columns({ ratio: "wide-right", valign: "center" }, [
                  [block("Image", { src: "", alt: "Book cover", aspect: "3/4", maxWidth: 360 })],
                  [
                    block("Badge", { text: "Free book · just cover shipping", style: "outline", icon: "none" }),
                    block("Heading", { text: "The Simple Sales System", level: "h1", size: "xl", align: "left" }),
                    text("<p>The 240-page playbook used by 12,000+ entrepreneurs to sell without feeling salesy.</p>", {
                      align: "left",
                      size: "xl",
                    }),
                    block("Checklist", {
                      items: [
                        { text: "Hardcover, shipped worldwide" },
                        { text: "Bonus: 30 copy-and-paste scripts" },
                        { text: "Read it in one weekend" },
                      ],
                    }),
                    block("Button", { label: "Send me my free copy", align: "left", sublabel: "Only $7.95 shipping" }),
                  ],
                ]),
              ]),
              section({ background: "subtle", padding: "lg" }, [block("Testimonials", {})]),
            ],
            t,
          ),
      },
      { name: "Shipping details", type: "checkout" },
      { name: "Audiobook upgrade", type: "upsell" },
      {
        name: "Thank you",
        type: "thankyou",
        build: thanks(
          "Thank you",
          "Your book is on its way",
          "Expect it in 5–10 business days. Your digital bonuses are already in your inbox.",
        ),
      },
    ],
  },
  {
    id: "tripwire",
    name: "Tripwire",
    category: "Sales",
    description: "Low-ticket offer right after opt-in to turn leads into buyers.",
    theme: { preset: "Sunset", headingFont: "outfit", bodyFont: "dmsans" },
    steps: [
      { name: "Opt-in", type: "optin" },
      {
        name: "Special offer",
        type: "checkout",
        build: (t) => {
          const p = starterPage("checkout", "Special offer", t);
          (p.content as unknown[]).unshift(
            section({ background: "primary", padding: "sm" }, [
              text("<p><strong>One-time offer: this page won't show again</strong></p>", { muted: false, size: "md" }),
            ]),
          );
          return p;
        },
      },
      { name: "Upgrade", type: "upsell" },
      { name: "Thank you", type: "thankyou" },
    ],
  },
  {
    id: "product-launch",
    name: "Product launch",
    category: "Sales",
    description: "Long-form sales page with checkout, upsell and downsell.",
    theme: { preset: "Indigo", headingFont: "jakarta", bodyFont: "inter" },
    steps: [
      { name: "Sales page", type: "sales" },
      { name: "Checkout", type: "checkout" },
      { name: "Upsell", type: "upsell" },
      { name: "Downsell", type: "downsell" },
      { name: "Thank you", type: "thankyou" },
    ],
  },
  {
    id: "vsl",
    name: "Video sales letter",
    category: "Sales",
    description: "Let a video do the selling, with the button right below it.",
    theme: { preset: "Rose", headingFont: "manrope", bodyFont: "inter" },
    steps: [
      {
        name: "Watch the video",
        type: "sales",
        build: (t) =>
          page(
            "Watch the video",
            [
              section({ background: "gradient", padding: "lg" }, [
                block("Badge", { text: "Watch before it's taken down", icon: "dot" }),
                block("Heading", {
                  text: "Watch: the 4-minute method that doubled our sales",
                  highlight: "doubled our sales",
                  level: "h1",
                  size: "xl",
                }),
                block("Video", { maxWidth: "lg", autoplay: false }),
                block("Button", {
                  label: "Yes! I want access",
                  size: "xl",
                  sublabel: "Instant access · 30-day guarantee",
                }),
                block("LogoBar", {}),
              ]),
            ],
            t,
          ),
      },
      { name: "Checkout", type: "checkout" },
      { name: "Thank you", type: "thankyou" },
    ],
  },
  {
    id: "application",
    name: "Coaching application",
    category: "Services",
    description: "Qualify high-ticket leads with an application before the call.",
    theme: { preset: "Emerald", primary: "#059669", headingFont: "fraunces", bodyFont: "inter" },
    steps: [
      {
        name: "Program",
        type: "page",
        build: (t) =>
          page(
            "Program",
            [
              section({ background: "gradient", padding: "xl" }, [
                block("Badge", { text: "Now accepting applications", icon: "dot" }),
                block("Heading", {
                  text: "Private coaching for founders ready to scale past $1M",
                  highlight: "$1M",
                  level: "h1",
                  size: "display",
                }),
                text("<p>A 12-week program with weekly 1:1 calls. Limited to 8 founders per quarter.</p>", {
                  size: "xl",
                }),
                block("Button", { label: "Apply now", size: "xl" }),
              ]),
              section({ padding: "lg" }, [block("Stats", {}), block("Testimonials", { layout: "single" })]),
            ],
            t,
          ),
      },
      {
        name: "Application",
        type: "optin",
        build: (t) =>
          page(
            "Application",
            [
              section({ background: "subtle", padding: "xl", width: "narrow" }, [
                block("ProgressBar", { percent: 50, label: "Step 1 of 2: tell us about you" }),
                block("Heading", { text: "Apply for a strategy call", level: "h1", size: "lg" }),
                block("OptInForm", {
                  askPhone: true,
                  buttonLabel: "Submit my application",
                  privacyNote: "We reply within 24 hours.",
                }),
              ]),
            ],
            t,
          ),
      },
      {
        name: "Application received",
        type: "thankyou",
        build: thanks(
          "Application received",
          "Thanks! We'll be in touch within 24 hours",
          "Watch this short video so you know exactly what to expect on our call.",
        ),
      },
    ],
  },
  {
    id: "saas-trial",
    name: "SaaS free trial",
    category: "Sales",
    description: "Modern product page with pricing and a trial checkout.",
    theme: { preset: "Indigo", primary: "#4f46e5", headingFont: "grotesk", bodyFont: "inter", buttonRadius: "lg" },
    steps: [
      {
        name: "Product",
        type: "sales",
        build: (t) =>
          page(
            "Product",
            [
              section({ background: "gradient", padding: "xl" }, [
                block("Badge", { text: "New: AI assistant", icon: "star" }),
                block("Heading", {
                  text: "Your whole team's workflow, finally in one place",
                  highlight: "in one place",
                  level: "h1",
                  size: "display",
                }),
                text("<p>Start free for 14 days. No credit card surprises: cancel in one click.</p>", { size: "xl" }),
                block("Button", { label: "Start my free trial", size: "xl" }),
                block("Image", { src: "", alt: "Product screenshot", aspect: "16/9" }),
              ]),
              section({ padding: "lg" }, [
                block("Heading", { text: "Everything you need", size: "lg" }),
                block("Features", { columns: "3" }),
              ]),
              section({ background: "subtle", padding: "lg" }, [
                block("Heading", { text: "Simple pricing", size: "lg" }),
                block("Pricing", {}),
              ]),
              section({ padding: "lg" }, [block("Faq", {})]),
            ],
            t,
          ),
      },
      { name: "Start trial", type: "checkout" },
      {
        name: "Welcome",
        type: "thankyou",
        build: thanks("Welcome", "Welcome aboard!", "Your trial is active. Check your inbox for your login link."),
      },
    ],
  },
  {
    id: "course",
    name: "Online course",
    category: "Sales",
    description: "Course sales page with curriculum, bonuses and guarantee.",
    theme: { preset: "Emerald", headingFont: "fraunces", bodyFont: "dmsans" },
    steps: [
      {
        name: "Course",
        type: "sales",
        build: (t) =>
          page(
            "Course",
            [
              section({ background: "gradient", padding: "xl" }, [
                block("Badge", { text: "Enrollment open", icon: "dot" }),
                block("Heading", {
                  text: "Master watercolor in 30 days, even if you've never painted",
                  highlight: "30 days",
                  level: "h1",
                  size: "display",
                }),
                block("Video", {}),
                block("Button", { label: "Enroll now", size: "xl", sublabel: "Lifetime access" }),
              ]),
              section({ padding: "lg", width: "narrow" }, [
                block("Heading", { text: "What's inside", size: "lg" }),
                block("Checklist", {
                  items: [
                    { text: "42 HD video lessons" },
                    { text: "Printable practice sheets" },
                    { text: "Private community" },
                    { text: "Certificate of completion" },
                  ],
                  columns: "2",
                }),
                block("Guarantee", {}),
              ]),
              section({ background: "subtle", padding: "lg" }, [block("Testimonials", {}), block("Faq", {})]),
            ],
            t,
          ),
      },
      { name: "Checkout", type: "checkout" },
      { name: "Add the masterclass", type: "upsell" },
      { name: "Welcome", type: "thankyou" },
    ],
  },
  {
    id: "ecommerce",
    name: "Single product store",
    category: "Sales",
    description: "Product page for one hero product, with a bundle upsell.",
    theme: { preset: "Rose", headingFont: "outfit", bodyFont: "inter", radius: "lg", buttonRadius: "full" },
    steps: [
      {
        name: "Product",
        type: "sales",
        build: (t) =>
          page(
            "Product",
            [
              section({ padding: "lg" }, [
                columns({ ratio: "equal", valign: "center" }, [
                  [block("Image", { src: "", alt: "Product photo", aspect: "1/1" })],
                  [
                    block("Badge", { text: "★ 4.9 from 2,300 reviews", style: "soft", icon: "none" }),
                    block("Heading", {
                      text: "The everyday bottle that keeps drinks cold for 24h",
                      level: "h1",
                      size: "xl",
                      align: "left",
                    }),
                    text("<p>Leak-proof, dishwasher-safe and made from recycled steel.</p>", {
                      align: "left",
                      size: "lg",
                      maxWidth: "full",
                    }),
                    block("Checklist", {
                      items: [
                        { text: "Free shipping over $50" },
                        { text: "Lifetime warranty" },
                        { text: "30-night trial" },
                      ],
                    }),
                    block("Button", { label: "Buy now: $39", align: "left", fullWidth: true }),
                  ],
                ]),
              ]),
              section({ background: "subtle", padding: "lg" }, [block("Stats", {}), block("Testimonials", {})]),
            ],
            t,
          ),
      },
      { name: "Checkout", type: "checkout" },
      { name: "Bundle offer", type: "upsell" },
      {
        name: "Order confirmed",
        type: "thankyou",
        build: thanks(
          "Order confirmed",
          "Thank you for your order!",
          "You'll receive a confirmation email with tracking details shortly.",
        ),
      },
    ],
  },
];

/** Every step of a template, with pages built in the template's theme. */
export function buildTemplate(id: string) {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) return null;
  return t.steps.map((s) => ({
    name: s.name,
    type: s.type,
    page: s.build ? s.build(t.theme) : starterPage(s.type, s.name, t.theme),
  }));
}
