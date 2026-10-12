import type { Shape } from "../../core";
import type { palette as en } from "../en/palette";

export const palette: Shape<typeof en> = {
  open: "ابحث أو انتقل إلى…",
  title: "لوحة الأوامر",
  placeholder: "ابحث في الأقماع وجهات الاتصال والطلبات… أو اكتب أمرًا",
  results: "النتائج",
  searching: "جارٍ البحث…",
  noResults: "لم نجد شيئًا يطابق «{query}».",
  hint: "تنقّل بالسهمين ↑ ↓، واضغط Enter للفتح وEsc للإغلاق.",
  sections: {
    recent: "زرتها مؤخرًا",
    actions: "إجراءات سريعة",
    goTo: "انتقل إلى",
    funnels: "أقماع المبيعات",
    pages: "صفحات الأقماع",
    contacts: "جهات الاتصال",
    orders: "الطلبات",
    products: "المنتجات",
    courses: "الدورات",
    settings: "الإعدادات",
    workspaces: "بدّل مساحة العمل",
  },
  newItem: "أنشئ {item}",
  goTo: "انتقل إلى {page}",
  switchTo: "انتقل إلى مساحة {name}",
  toggleTheme: "فعّل المظهر {theme}",
  themeDark: "الداكن",
  themeLight: "الفاتح",
  switchLanguage: "اعرض لوحة التحكم بالإنجليزية (English)",
  order: "الطلب رقم {number}",
  inFunnel: "ضمن {funnel}",
};
