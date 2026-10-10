import type { PageData } from "./config";
import { block, columns, page, section, type StarterStepType } from "./starters";
import type { PageTheme } from "./theme";

const text = (html: string, extra: Record<string, unknown> = {}) => block("Text", { text: html, ...extra });

/**
 * Arabic starting pages, written natively for Arab audiences (not translated from the English ones).
 * Called inside withLang("ar"), so blocks without explicit text get the Arabic defaults.
 */
export function starterPageAr(
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
            block("Badge", { text: "دليل مجاني", icon: "star" }),
            block("Heading", {
              text: "احصل على خطة الخطوات السبع التي تضاعف عملاءك المحتملين",
              highlight: "تضاعف عملاءك المحتملين",
              level: "h1",
              size: "display",
            }),
            text("<p>النظام نفسه الذي نحوّل به الزوار الباردين إلى مكالمات محجوزة، مجانًا ولفترة محدودة.</p>"),
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
            block("Badge", { text: "التسجيل يُغلق قريبًا", icon: "dot" }),
            block("Heading", {
              text: "النظام المتكامل لإطلاق عرضك خلال 30 يومًا",
              highlight: "خلال 30 يومًا",
              level: "h1",
              size: "display",
            }),
            text("<p>كل ما تحتاجه من الفكرة حتى أول عملية بيع، دون تخمين أو تجارب مكلفة.</p>", { size: "xl" }),
            block("Video", {}),
            block("Button", { label: "احصل على الوصول فورًا", sublabel: "ضمان استرداد خلال 30 يومًا", size: "xl" }),
          ]),
          section({ padding: "lg" }, [
            block("Heading", { text: "ماذا ستحصل عليه؟", size: "lg" }),
            block("Features", {}),
          ]),
          section({ background: "subtle", padding: "lg" }, [
            block("Heading", { text: "يثق بنا آلاف صنّاع المحتوى", size: "lg" }),
            block("Testimonials", {}),
            block("Stats", {}),
          ]),
          section({ padding: "lg", width: "narrow" }, [
            block("Guarantee", {}),
            block("Button", { label: "نعم، أنا معكم", size: "xl" }),
          ]),
          section({ background: "subtle", padding: "lg" }, [
            block("Heading", { text: "لديك سؤال؟", size: "lg" }),
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
            block("ProgressBar", { percent: 90, label: "خطوة أخيرة: أكمل طلبك" }),
            columns({ ratio: "wide-left", valign: "top", reverseOnMobile: true }, [
              [block("Heading", { text: "أكمل طلبك", size: "md", align: "left" }), block("OrderForm", {})],
              [
                block("Heading", { text: "إليك ما ستحصل عليه", size: "sm", align: "left" }),
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
                ? "<p><strong>لحظة! طلبك لم يكتمل بعد.</strong></p>"
                : "<p><strong>مهلًا، لدينا لك خيار أخف.</strong></p>",
              { size: "md", muted: false },
            ),
          ]),
          section({ padding: "xl", width: "narrow" }, [
            block("Heading", {
              text: type === "upsell" ? "أضف القوالب الجاهزة للتنفيذ بخصم 60%" : "احصل على القوالب وحدها مقابل $27",
              highlight: type === "upsell" ? "بخصم 60%" : "$27",
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
            block("Badge", { text: "أهلًا بك معنا", icon: "star", style: "solid" }),
            block("Heading", {
              text: "شكرًا لك! تفقّد بريدك الوارد",
              highlight: "تفقّد بريدك الوارد",
              level: "h1",
              size: "xl",
            }),
            text("<p>أرسلنا كل شيء إلى بريدك. وإلى أن يصلك، إليك خطوتك التالية.</p>"),
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
            text("<p>ابدأ بناء صفحتك من هنا.</p>"),
            block("Button", {}),
          ]),
        ],
        theme,
      );
  }
}
