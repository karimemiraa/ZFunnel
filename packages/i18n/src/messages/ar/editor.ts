import type { Shape } from "../../core";
import type { editor as en } from "../en/editor";

export const editor: Shape<typeof en> = {
  title: "المحرّر",
  unsaved: "تغييرات غير محفوظة",
  notSaved: "لم يُحفظ",
  backToFunnel: "العودة إلى القمع",
  variantBadge: "النسخة {name}",
  switchStep: "انتقل إلى خطوة أخرى",
  backToOverview: "العودة إلى نظرة عامة على القمع",
  undo: "تراجع",
  redo: "إعادة",
  undoShortcut: "تراجع (⌘Z)",
  redoShortcut: "إعادة (⇧⌘Z)",
  preview: "معاينة",
  publish: "نشر",
  published: "تم النشر! صفحتك متاحة الآن للجميع.",
  variantLive: "النسخة {name} تعمل الآن ضمن اختبار A/B.",
  desktop: "سطح المكتب",
  tablet: "جهاز لوحي",
  mobile: "الجوال",
  draftPreview: "معاينة المسودة",
  previewTitle: "معاينة",
  variantName: "النسخة {name}",
};
