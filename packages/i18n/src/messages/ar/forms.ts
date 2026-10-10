import type { Shape } from "../../core";
import type { forms as en } from "../en/forms";

export const forms: Shape<typeof en> = {
  firstName: "اسمك الأول",
  bestEmail: "بريدك الإلكتروني الذي تتابعه",
  phone: "رقم الجوال",
  name: "الاسم",
  email: "البريد الإلكتروني",
  phoneLabel: "الجوال",
  choose: "اختر…",
  notInEditor: "يعمل النموذج على صفحتك المنشورة، وليس داخل المحرر.",
  answerRequired: "أجب عن هذا السؤال من فضلك: {question}",
  answerToContinue: "أجب عن هذا السؤال لتنتقل إلى التالي.",
  yourResult: "نتيجتك",
  addQuestions: "أضف الأسئلة من اللوحة الجانبية ←",
  whereToSend: "إلى أين نرسل لك نتيجتك؟",
  next: "التالي",
  back: "السابق",
  progress: "{step} من {total}",
  days: "أيام",
  hours: "ساعات",
  minutes: "دقائق",
  seconds: "ثوانٍ",
  dayShort: "ي",
  hourShort: "س",
  minuteShort: "د",
  secondShort: "ث",
  /** Labels for answer options, in order. */
  letters: "أ ب ج د هـ و ز ح ط ي ك ل م ن س ع",
  upsellEditorHint: "اربط منتج العرض الإضافي بهذه الخطوة ليُشترى بنقرة واحدة.",
};
