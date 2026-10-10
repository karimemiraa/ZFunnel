import type { Shape } from "../../core";
import type { settings as en } from "../en/settings";

export const settings: Shape<typeof en> = {
  title: "الإعدادات",
  description: "أدِر مساحة العمل هذه ومن يمكنه الوصول إليها.",
  tabs: {
    general: "عام",
    payments: "المدفوعات",
    domains: "النطاقات",
    team: "الفريق",
    billing: "الاشتراك والفوترة",
    sms: "الرسائل النصية",
    tracking: "تتبّع الإعلانات",
    developers: "المطوّرون",
    activity: "سجل النشاط",
  },
  general: "عام",
  renameHint: "غيّر اسم مساحة العمل.",
  onlyAdmins: "تعديل هذه الإعدادات متاح للمالكين والمشرفين فقط.",
  workspaceName: "اسم مساحة العمل",
  renamed: "تم الحفظ.",
  branding: "الهوية البصرية",
  brandingHint: "اجعل صفحاتك ورسائلك لعملائك تحمل هوية نشاطك التجاري.",
  siteLanguage: "لغة الموقع",
  siteLanguageHint:
    "لغة صفحاتك العامة وصفحة الدفع ومركز العملاء ومنطقة الأعضاء والرسائل التي تصل إلى عملائك. الصفحات العربية تُعرض من اليمين إلى اليسار.",
  siteLanguageSaved: "تم حفظ لغة الموقع",
  subdomain: "النطاق الفرعي المجاني",
  subdomainHint: "تبقى أقماعك المنشورة متاحة هنا دائمًا، حتى بعد ربط نطاقك الخاص من الإعدادات ← النطاقات.",
};
