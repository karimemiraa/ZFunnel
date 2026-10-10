import type { Shape } from "../../core";
import type { payments as en } from "../en/payments";

export const payments: Shape<typeof en> = {
  accepting: "تستقبل المدفوعات",
  setupIncomplete: "الإعداد غير مكتمل",
  notConnected: "غير مرتبط",
  description:
    "تصل المدفوعات مباشرةً إلى حسابك في Stripe، ولا تحتفظ ZFunnel بأموالك أبدًا. تحفظ Stripe البطاقات بأمان ليتمكن المشترون من قبول عروض الترقية بنقرة واحدة.",
  stripeAccount: "حساب Stripe",
  liveMode: "الوضع الفعلي",
  testMode: "وضع الاختبار",
  chargesEnabled: "الدفع مفعّل",
  finishOnboarding: "أكمل التسجيل في Stripe لتبدأ باستقبال المدفوعات",
  adminKeys: "لا يزال على مدير الخادم إضافة مفاتيح Stripe الخاصة بالمنصة",
  testModeOn: "وضع الاختبار مفعّل",
  testModeBody:
    "إلى أن تربط Stripe، تعمل صفحات الدفع عبر بوابة اختبار مدمجة لتجرّب قمع المبيعات كاملًا، بما فيه عروض الترقية بنقرة واحدة. استخدم البطاقة 4242 4242 4242 4242 مع أي تاريخ مستقبلي وأي رمز CVC. تظهر الطلبات التجريبية بعلامة واضحة ولا تُحوَّل أي أموال.",
  onlyAdmins: "تعديل إعدادات المدفوعات متاح للمالكين والمشرفين فقط.",
  continueSetup: "متابعة إعداد Stripe",
  connect: "الربط مع Stripe",
  statusUpdated: "تم تحديث الحالة",
  refresh: "تحديث الحالة",
  disconnectConfirm: "هل تريد فصل Stripe؟ ستتوقف صفحات الدفع عن استقبال المدفوعات حتى تعيد الربط.",
  disconnected: "تم فصل Stripe",
  disconnect: "فصل",
};
