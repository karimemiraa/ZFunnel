import type { Shape } from "../../core";
import type { nav as en } from "../en/nav";

export const nav: Shape<typeof en> = {
  overview: { label: "نظرة عامة", description: "كل ما يهمّك في مساحة عملك، بنظرة واحدة." },
  funnels: {
    label: "أقماع المبيعات",
    description: "صمّم صفحات الاشتراك والبيع والدفع والعروض الإضافية بالسحب والإفلات.",
  },
  products: {
    label: "المنتجات",
    description: "بِع بدفعة واحدة أو باشتراك أو بالتقسيط، مع عروض إضافية في سلة الشراء وترقيات بنقرة واحدة.",
  },
  orders: { label: "الطلبات", description: "تابع المشتريات والاستردادات والاشتراكات." },
  analytics: { label: "التحليلات", description: "الزيارات والمشتركون والمبيعات والإيرادات لكل خطوة في القمع." },
  contacts: { label: "جهات الاتصال", description: "نظام إدارة عملائك: جهات الاتصال والوسوم والشرائح." },
  forms: { label: "النماذج", description: "الاستبيانات والاختبارات والنماذج، وكل الردود ملخّصة أمامك." },
  pipelines: { label: "مسارات الصفقات", description: "حرّك صفقاتك بين مراحل البيع واعرف ما ينتظرك من فرص." },
  email: { label: "البريد", description: "حملات بريدية وسلاسل رسائل ومحرر رسائل بالسحب والإفلات." },
  automations: { label: "الأتمتة", description: "سيناريوهات مرئية: مُحفِّزات وانتظار وتفرّعات وإجراءات." },
  inbox: { label: "صندوق الوارد", description: "محادثات زوّار موقعك في مكان واحد." },
  community: { label: "المجتمع", description: "مساحات نقاش خاصة بالأعضاء، تحت إشرافك." },
  affiliates: { label: "التسويق بالعمولة", description: "برنامج شركاء: روابط إحالة وعمولات ومدفوعات." },
  blog: { label: "المدونة", description: "مقالات محسّنة لمحركات البحث، مع خريطة موقع وخلاصة RSS." },
  courses: { label: "الدورات", description: "دورات وعضويات بمحتوى يُفتح تدريجيًا وتتبّع لتقدّم الطلاب." },
  webinars: { label: "الندوات", description: "ندوات مباشرة ومؤتمتة مع تذكيرات وإعادة عرض وعروض بيع." },
  calendars: { label: "التقويمات", description: "صفحات حجز مواعيد حسب أوقات تفرّغك." },
  settings: { label: "الإعدادات", description: "مساحة العمل والفريق وسجل النشاط." },
};
