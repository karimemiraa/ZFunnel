import type { Shape } from "../../core";
import type { utm as en } from "../en/utm";

export const utm: Shape<typeof en> = {
  menu: "رابط UTM ورمز QR",
  title: "رابط UTM ورمز QR",
  description: "اعرف من أين يأتي زوار «{name}». املأ الحقول، ثم انسخ الرابط أو نزّل رمز QR.",
  fields: {
    source: "المصدر",
    medium: "الوسيلة",
    campaign: "الحملة",
    term: "الكلمة المفتاحية",
    content: "المحتوى",
  },
  placeholders: {
    source: "facebook أو google أو newsletter",
    medium: "cpc أو social أو email",
    campaign: "عروض_الربيع",
    term: "أحذية رياضية",
    content: "بانر_أزرق",
  },
  optional: "(اختياري)",
  result: "رابطك الجاهز",
  copied: "نسخنا الرابط",
  qrAlt: "رمز QR لهذا الرابط",
  hint: "نحوّل الحروف اللاتينية إلى أحرف صغيرة والمسافات إلى شرطات سفلية، لتبقى تقاريرك مرتبة. ورمز QR يطابق الرابط أعلاه دائمًا.",
};
