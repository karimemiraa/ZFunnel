import type { Shape } from "../../core";
import type { common as en } from "../en/common";

export const common: Shape<typeof en> = {
  save: "حفظ",
  saving: "جارٍ الحفظ…",
  saved: "تم الحفظ",
  cancel: "إلغاء",
  delete: "حذف",
  edit: "تعديل",
  close: "إغلاق",
  back: "رجوع",
  next: "التالي",
  create: "إنشاء",
  copy: "نسخ",
  copied: "تم النسخ",
  search: "بحث",
  loading: "جارٍ التحميل…",
  optional: "اختياري",
  somethingWrong: "حدث خطأ ما، حاول مرة أخرى من فضلك.",
  tooManyAttempts: "محاولات كثيرة في وقت قصير. انتظر دقيقة ثم أعد المحاولة.",
  invalidEmail: "أدخل بريدًا إلكترونيًا صحيحًا من فضلك.",
  language: "اللغة",
  poweredBy: "مدعوم من ZFunnel",
};
