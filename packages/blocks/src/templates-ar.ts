import type { PageData } from "./config";
import { block, columns, page, section, starterPage, type StarterStepType } from "./starters";
import type { PageTheme } from "./theme";

type Theme = Partial<PageTheme & { preset: string }>;
type StepSpec = { name: string; type: StarterStepType; build?: (t: Theme) => PageData };
/** Arabic copy of a template: same id, design and step types as the English one; text written natively. */
export type ArabicTemplate = { name: string; description: string; steps: StepSpec[] };

const text = (html: string, extra: Record<string, unknown> = {}) => block("Text", { text: html, ...extra });
const starter = (type: StarterStepType, name: string) => (t: Theme) => starterPage(type, name, t, "ar");
const thanks = (name: string, headline: string, body: string) => (t: Theme) =>
  page(
    name,
    [
      section({ background: "gradient", padding: "xl", width: "narrow" }, [
        block("Badge", { text: "تم التأكيد", icon: "star", style: "solid" }),
        block("Heading", { text: headline, level: "h1", size: "xl" }),
        text(`<p>${body}</p>`),
        block("Video", {}),
      ]),
    ],
    t,
  );

/** Built inside withLang("ar"), so blocks without explicit text use the Arabic defaults. */
export const TEMPLATES_AR: Record<string, ArabicTemplate> = {
  quiz: {
    name: "قمع اختبار تفاعلي",
    description: "اختبار ممتع بسؤال واحد في كل مرة، يقيّم العملاء المحتملين ويصنّفهم حسب نتيجتهم.",
    steps: [
      {
        name: "الاختبار",
        type: "optin",
        build: (t) =>
          page(
            "الاختبار",
            [
              section({ background: "gradient", padding: "lg", width: "narrow" }, [
                block("Badge", { text: "اختبار في 60 ثانية", icon: "star" }),
                block("Heading", { text: "ما الذي يعيق نمو مشروعك؟", level: "h1", size: "xl" }),
                text("<p>أجب عن 3 أسئلة سريعة، واحصل على خطة مخصصة لأيامك التسعين القادمة.</p>"),
                block("Survey", {
                  formName: "اختبار النمو",
                  quiz: true,
                  tag: "quiz-taker",
                  buttonLabel: "اعرض نتيجتي",
                  questions: [
                    {
                      label: "من أين يأتيك معظم عملائك اليوم؟",
                      type: "single_choice",
                      required: true,
                      options:
                        "التوصيات الشفهية | 1\nوسائل التواصل الاجتماعي | 2\nالإعلانات المدفوعة | 3\nقمع مبيعات | 4",
                      saveTo: "channel",
                    },
                    {
                      label: "كم عميلًا محتملًا يصلك أسبوعيًا؟",
                      type: "single_choice",
                      required: true,
                      options: "أقل من 10 | 1\nمن 10 إلى 50 | 2\nمن 50 إلى 200 | 3\nأكثر من 200 | 4",
                      saveTo: "",
                    },
                    {
                      label: "ما أول شيء تريد إصلاحه؟",
                      type: "single_choice",
                      required: true,
                      options: "جلب زيارات أكثر | 1\nتحويل الزوار إلى عملاء | 2\nالبيع أكثر لعملائي الحاليين | 3",
                      saveTo: "goal",
                    },
                  ],
                  outcomes: [
                    { minScore: 0, title: "مرحلة بناء الأساس", tag: "result-foundation", redirect: "" },
                    { minScore: 6, title: "مرحلة صناعة الزخم", tag: "result-momentum", redirect: "" },
                    { minScore: 9, title: "مرحلة التوسّع", tag: "result-scale", redirect: "" },
                  ],
                }),
              ]),
            ],
            t,
          ),
      },
      {
        name: "خطتك",
        type: "thankyou",
        build: thanks(
          "خطتك",
          "خطتك المخصصة في طريقها إليك!",
          "أرسلنا نتيجتك وخطة عملية خطوة بخطوة إلى بريدك. شاهد هذا الفيديو القصير لتبدأ فورًا.",
        ),
      },
    ],
  },
  "lead-magnet": {
    name: "هدية مجانية لجمع العملاء",
    description: "قدّم دليلًا مجانيًا ووسّع قائمتك البريدية.",
    steps: [
      { name: "الدليل المجاني", type: "optin", build: starter("optin", "الدليل المجاني") },
      {
        name: "شكرًا لك",
        type: "thankyou",
        build: thanks(
          "شكرًا لك",
          "دليلك في الطريق إليك!",
          "تفقّد بريدك خلال دقيقتين. وإليك فيديو قصيرًا تعرف منه كيف تستفيد من الدليل إلى أقصى حد.",
        ),
      },
    ],
  },
  webinar: {
    name: "التسجيل في ندوة",
    description: "صفحة تسجيل داكنة مليئة بالحماس، مع عدّاد تنازلي مباشر.",
    steps: [
      {
        name: "التسجيل",
        type: "optin",
        build: (t) =>
          page(
            "التسجيل",
            [
              section({ background: "gradient", padding: "xl", width: "narrow" }, [
                block("Badge", { text: "تدريب مباشر ومجاني", icon: "dot" }),
                block("Heading", {
                  text: "كيف تملأ جدولك بعملاء الخدمات المميزة خلال 30 يومًا",
                  highlight: "عملاء الخدمات المميزة",
                  level: "h1",
                  size: "display",
                }),
                text("<p>الخميس الساعة 8 مساءً بتوقيت مكة · 60 دقيقة · أسئلة وأجوبة مباشرة في الختام</p>", {
                  size: "lg",
                }),
                block("Countdown", { mode: "evergreen", minutes: 60 * 48 }),
                block("OptInForm", {
                  buttonLabel: "احجز مقعدي المجاني",
                  privacyNote: "المقاعد محدودة بـ 500 مشارك فقط.",
                }),
              ]),
              section({ background: "subtle", padding: "lg" }, [
                block("Heading", { text: "ماذا ستتعلم؟", size: "lg" }),
                block("Features", {
                  items: [
                    {
                      icon: "target",
                      title: "الإقناع في 3 مكالمات",
                      text: "إطار بسيط يحوّل المحادثات إلى عملاء يدفعون.",
                    },
                    { icon: "users", title: "اجذب المشترين لا المتفرجين", text: "أين يجتمع أفضل عملائك اليوم بالفعل." },
                    { icon: "rocket", title: "انطلق في عطلة نهاية أسبوع", text: "كل ما تحتاجه لتبدأ هذا الأسبوع." },
                  ],
                }),
              ]),
            ],
            t,
          ),
      },
      {
        name: "تم تسجيلك",
        type: "thankyou",
        build: thanks(
          "تم تسجيلك",
          "مقعدك محجوز! أضف الموعد إلى تقويمك",
          "أرسلنا رابط الدخول إلى بريدك. احضر مباشرة لتحصل على كتيّب التطبيق هدية.",
        ),
      },
    ],
  },
  book: {
    name: "كتاب مجاني مقابل الشحن",
    description: "تصميم أنيق للمؤلفين: الكتاب، ثم عرض ترقية للنسخة الصوتية.",
    steps: [
      {
        name: "عرض الكتاب",
        type: "sales",
        build: (t) =>
          page(
            "عرض الكتاب",
            [
              section({ padding: "xl" }, [
                columns({ ratio: "wide-right", valign: "center" }, [
                  [block("Image", { src: "", alt: "غلاف الكتاب", aspect: "3/4", maxWidth: 360 })],
                  [
                    block("Badge", { text: "الكتاب مجاني · ادفع الشحن فقط", style: "outline", icon: "none" }),
                    block("Heading", { text: "نظام المبيعات البسيط", level: "h1", size: "xl", align: "left" }),
                    text("<p>دليل عملي من 240 صفحة اعتمده أكثر من 12,000 رائد أعمال ليبيعوا دون إلحاح أو إحراج.</p>", {
                      align: "left",
                      size: "xl",
                    }),
                    block("Checklist", {
                      items: [
                        { text: "نسخة مطبوعة بغلاف فاخر، تُشحن لأي مكان" },
                        { text: "هدية: 30 نصًا بيعيًا جاهزًا للنسخ" },
                        { text: "تنهيه في عطلة نهاية أسبوع واحدة" },
                      ],
                    }),
                    block("Button", { label: "أرسلوا لي نسختي المجانية", align: "left", sublabel: "الشحن فقط $7.95" }),
                  ],
                ]),
              ]),
              section({ background: "subtle", padding: "lg" }, [block("Testimonials", {})]),
            ],
            t,
          ),
      },
      { name: "بيانات الشحن", type: "checkout", build: starter("checkout", "بيانات الشحن") },
      { name: "ترقية إلى الكتاب الصوتي", type: "upsell", build: starter("upsell", "ترقية إلى الكتاب الصوتي") },
      {
        name: "شكرًا لك",
        type: "thankyou",
        build: thanks(
          "شكرًا لك",
          "كتابك في الطريق إليك",
          "يصلك خلال 5 إلى 10 أيام عمل، وهداياك الرقمية بانتظارك الآن في بريدك.",
        ),
      },
    ],
  },
  tripwire: {
    name: "عرض أول بسعر رمزي",
    description: "عرض منخفض السعر بعد الاشتراك مباشرة، يحوّل المهتمين إلى مشترين.",
    steps: [
      { name: "الاشتراك", type: "optin", build: starter("optin", "الاشتراك") },
      {
        name: "عرض خاص",
        type: "checkout",
        build: (t) => {
          const p = starterPage("checkout", "عرض خاص", t, "ar");
          (p.content as unknown[]).unshift(
            section({ background: "primary", padding: "sm" }, [
              text("<p><strong>عرض لمرة واحدة: لن تظهر هذه الصفحة مجددًا</strong></p>", { muted: false, size: "md" }),
            ]),
          );
          return p;
        },
      },
      { name: "الترقية", type: "upsell", build: starter("upsell", "الترقية") },
      { name: "شكرًا لك", type: "thankyou", build: starter("thankyou", "شكرًا لك") },
    ],
  },
  "product-launch": {
    name: "إطلاق منتج",
    description: "صفحة مبيعات طويلة مع الدفع وعرض ترقية وعرض بديل.",
    steps: [
      { name: "صفحة المبيعات", type: "sales", build: starter("sales", "صفحة المبيعات") },
      { name: "الدفع", type: "checkout", build: starter("checkout", "الدفع") },
      { name: "عرض الترقية", type: "upsell", build: starter("upsell", "عرض الترقية") },
      { name: "العرض البديل", type: "downsell", build: starter("downsell", "العرض البديل") },
      { name: "شكرًا لك", type: "thankyou", build: starter("thankyou", "شكرًا لك") },
    ],
  },
  vsl: {
    name: "رسالة مبيعات بالفيديو",
    description: "دع الفيديو يقنع عملاءك، وزر الشراء أسفله مباشرة.",
    steps: [
      {
        name: "شاهد الفيديو",
        type: "sales",
        build: (t) =>
          page(
            "شاهد الفيديو",
            [
              section({ background: "gradient", padding: "lg" }, [
                block("Badge", { text: "شاهده قبل حذفه", icon: "dot" }),
                block("Heading", {
                  text: "شاهد: الطريقة التي ضاعفت مبيعاتنا في 4 دقائق",
                  highlight: "ضاعفت مبيعاتنا",
                  level: "h1",
                  size: "xl",
                }),
                block("Video", { maxWidth: "lg", autoplay: false }),
                block("Button", { label: "نعم! أريد الوصول الآن", size: "xl", sublabel: "وصول فوري · ضمان 30 يومًا" }),
                block("LogoBar", {}),
              ]),
            ],
            t,
          ),
      },
      { name: "الدفع", type: "checkout", build: starter("checkout", "الدفع") },
      { name: "شكرًا لك", type: "thankyou", build: starter("thankyou", "شكرًا لك") },
    ],
  },
  application: {
    name: "طلب انضمام لبرنامج إرشاد",
    description: "اختر عملاء الخدمات المميزة بطلب انضمام قبل المكالمة.",
    steps: [
      {
        name: "البرنامج",
        type: "page",
        build: (t) =>
          page(
            "البرنامج",
            [
              section({ background: "gradient", padding: "xl" }, [
                block("Badge", { text: "باب التقديم مفتوح الآن", icon: "dot" }),
                block("Heading", {
                  text: "إرشاد خاص لرواد الأعمال المستعدين لتجاوز المليون دولار",
                  highlight: "المليون دولار",
                  level: "h1",
                  size: "display",
                }),
                text("<p>برنامج من 12 أسبوعًا بجلسة فردية كل أسبوع. نقبل 8 رواد أعمال فقط كل ربع سنة.</p>", {
                  size: "xl",
                }),
                block("Button", { label: "قدّم طلبك الآن", size: "xl" }),
              ]),
              section({ padding: "lg" }, [block("Stats", {}), block("Testimonials", { layout: "single" })]),
            ],
            t,
          ),
      },
      {
        name: "طلب الانضمام",
        type: "optin",
        build: (t) =>
          page(
            "طلب الانضمام",
            [
              section({ background: "subtle", padding: "xl", width: "narrow" }, [
                block("ProgressBar", { percent: 50, label: "الخطوة 1 من 2: عرّفنا بنفسك" }),
                block("Heading", { text: "اطلب مكالمة استراتيجية", level: "h1", size: "lg" }),
                block("OptInForm", {
                  askPhone: true,
                  buttonLabel: "أرسل طلبي",
                  privacyNote: "نرد على الطلبات خلال 24 ساعة.",
                }),
              ]),
            ],
            t,
          ),
      },
      {
        name: "تم استلام طلبك",
        type: "thankyou",
        build: thanks(
          "تم استلام طلبك",
          "شكرًا لك! سنتواصل معك خلال 24 ساعة",
          "شاهد هذا الفيديو القصير لتعرف بالضبط ما ينتظرك في مكالمتنا.",
        ),
      },
    ],
  },
  "saas-trial": {
    name: "تجربة مجانية لبرنامج سحابي",
    description: "صفحة منتج عصرية مع الأسعار ودفع لبدء التجربة.",
    steps: [
      {
        name: "المنتج",
        type: "sales",
        build: (t) =>
          page(
            "المنتج",
            [
              section({ background: "gradient", padding: "xl" }, [
                block("Badge", { text: "جديد: مساعد ذكي", icon: "star" }),
                block("Heading", {
                  text: "كل أعمال فريقك، أخيرًا في مكان واحد",
                  highlight: "في مكان واحد",
                  level: "h1",
                  size: "display",
                }),
                text("<p>ابدأ مجانًا لمدة 14 يومًا، وألغِ بنقرة واحدة متى شئت، بلا مفاجآت في بطاقتك.</p>", {
                  size: "xl",
                }),
                block("Button", { label: "ابدأ تجربتي المجانية", size: "xl" }),
                block("Image", { src: "", alt: "لقطة من المنتج", aspect: "16/9" }),
              ]),
              section({ padding: "lg" }, [
                block("Heading", { text: "كل ما تحتاجه", size: "lg" }),
                block("Features", { columns: "3" }),
              ]),
              section({ background: "subtle", padding: "lg" }, [
                block("Heading", { text: "أسعار واضحة وبسيطة", size: "lg" }),
                block("Pricing", {}),
              ]),
              section({ padding: "lg" }, [block("Faq", {})]),
            ],
            t,
          ),
      },
      { name: "ابدأ التجربة", type: "checkout", build: starter("checkout", "ابدأ التجربة") },
      {
        name: "أهلًا بك",
        type: "thankyou",
        build: thanks("أهلًا بك", "أهلًا بك على متن الرحلة!", "تجربتك مفعّلة الآن. تفقّد بريدك لتجد رابط الدخول."),
      },
    ],
  },
  course: {
    name: "دورة أونلاين",
    description: "صفحة بيع دورة بالمنهج والهدايا والضمان.",
    steps: [
      {
        name: "الدورة",
        type: "sales",
        build: (t) =>
          page(
            "الدورة",
            [
              section({ background: "gradient", padding: "xl" }, [
                block("Badge", { text: "التسجيل مفتوح", icon: "dot" }),
                block("Heading", {
                  text: "أتقن الخط العربي في 30 يومًا، حتى لو لم تمسك قلم خط من قبل",
                  highlight: "في 30 يومًا",
                  level: "h1",
                  size: "display",
                }),
                block("Video", {}),
                block("Button", { label: "سجّل الآن", size: "xl", sublabel: "وصول مدى الحياة" }),
              ]),
              section({ padding: "lg", width: "narrow" }, [
                block("Heading", { text: "ماذا في الدورة؟", size: "lg" }),
                block("Checklist", {
                  items: [
                    { text: "42 درسًا بالفيديو بجودة عالية" },
                    { text: "كراسات تمرين جاهزة للطباعة" },
                    { text: "مجتمع خاص بالطلاب" },
                    { text: "شهادة إتمام" },
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
      { name: "الدفع", type: "checkout", build: starter("checkout", "الدفع") },
      { name: "أضف الدرس المتقدم", type: "upsell", build: starter("upsell", "أضف الدرس المتقدم") },
      { name: "أهلًا بك", type: "thankyou", build: starter("thankyou", "أهلًا بك") },
    ],
  },
  ecommerce: {
    name: "متجر لمنتج واحد",
    description: "صفحة منتج لمنتجك الرئيسي، مع عرض ترقية لباقة توفير.",
    steps: [
      {
        name: "المنتج",
        type: "sales",
        build: (t) =>
          page(
            "المنتج",
            [
              section({ padding: "lg" }, [
                columns({ ratio: "equal", valign: "center" }, [
                  [block("Image", { src: "", alt: "صورة المنتج", aspect: "1/1" })],
                  [
                    block("Badge", { text: "★ 4.9 من أكثر من 2,300 تقييم", style: "soft", icon: "none" }),
                    block("Heading", {
                      text: "المطارة اليومية التي تحفظ مشروبك باردًا 24 ساعة",
                      level: "h1",
                      size: "xl",
                      align: "left",
                    }),
                    text("<p>محكمة الإغلاق، تُغسل في غسالة الصحون، ومصنوعة من ستانلس ستيل معاد تدويره.</p>", {
                      align: "left",
                      size: "lg",
                      maxWidth: "full",
                    }),
                    block("Checklist", {
                      items: [
                        { text: "شحن مجاني للطلبات فوق $50" },
                        { text: "ضمان مدى الحياة" },
                        { text: "جرّبها 30 يومًا" },
                      ],
                    }),
                    block("Button", { label: "اشترِ الآن: $39", align: "left", fullWidth: true }),
                  ],
                ]),
              ]),
              section({ background: "subtle", padding: "lg" }, [block("Stats", {}), block("Testimonials", {})]),
            ],
            t,
          ),
      },
      { name: "الدفع", type: "checkout", build: starter("checkout", "الدفع") },
      { name: "عرض الباقة", type: "upsell", build: starter("upsell", "عرض الباقة") },
      {
        name: "تم تأكيد الطلب",
        type: "thankyou",
        build: thanks("تم تأكيد الطلب", "شكرًا لطلبك!", "ستصلك قريبًا رسالة تأكيد فيها رقم تتبّع الشحنة."),
      },
    ],
  },
};
