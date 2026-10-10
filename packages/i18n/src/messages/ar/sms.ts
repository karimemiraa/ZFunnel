import type { Shape } from "../../core";
import type { sms as en } from "../en/sms";

export const sms: Shape<typeof en> = {
  heading: "الرسائل النصية (Twilio)",
  intro: "اربط حسابك في Twilio لإرسال رسائل نصية من سيناريوهات الأتمتة. نشفّر رمز المصادقة ولن يظهر مرة أخرى.",
  accountSid: "معرّف الحساب (Account SID)",
  authToken: "رمز المصادقة (Auth token)",
  keepPlaceholder: "•••••••• (اتركه فارغًا للإبقاء عليه)",
  fromNumber: "رقم الإرسال",
  consent:
    "تصل الرسائل النصية فقط إلى جهات الاتصال التي لديها رقم هاتف. التزم بقواعد الموافقة المحلية على الرسائل النصية (مثل TCPA في الولايات المتحدة).",
  sidFormat: "يبدأ معرّف الحساب بـ AC ويليه 32 حرفًا",
  phoneFormat: "استخدم الصيغة الدولية، مثل +14155550100",
  onlyAdmins: "تعديل إعدادات الرسائل النصية متاح للمالكين والمشرفين فقط.",
  enterToken: "أدخل رمز المصادقة الخاص بـ Twilio.",
  saved: "تم حفظ إعدادات الرسائل النصية",
};
