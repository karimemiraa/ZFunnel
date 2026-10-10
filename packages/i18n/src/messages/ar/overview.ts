import type { Shape } from "../../core";
import type { overview as en } from "../en/overview";

export const overview: Shape<typeof en> = {
  title: "نظرة عامة",
  welcome: "أهلًا {name}",
  happening: "إليك آخر المستجدات في {workspace}.",
  gettingStarted: "خطواتك الأولى",
  gettingStartedHint: "أكمل هذه الخطوات وأطلق أول قمع مبيعات لك.",
  progress: "أنجزت {done} من {total}",
  stepWorkspace: "أنشئ مساحة عملك",
  stepPayments: "اربط حسابك في Stripe لتستقبل المدفوعات",
  stepFunnel: "ابنِ أول قمع مبيعات انطلاقًا من قالب جاهز",
  stepDomain: "اربط نطاقك الخاص",
  allDone: "كل شيء جاهز. حان وقت جلب الزوار إلى أقماعك.",
  comingTitle: "قسم {module} قادم قريبًا",
  comingText: "هذا القسم ضمن خطة تطوير ZFunnel.",
};
