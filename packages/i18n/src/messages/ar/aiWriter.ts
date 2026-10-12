import type { Shape } from "../../core";
import type { aiWriter as en } from "../en/aiWriter";

export const aiWriter: Shape<typeof en> = {
  open: "الكاتب الذكي",
  title: "الكاتب الذكي",
  actions: {
    rewrite: "أعد صياغته",
    shorten: "اختصره",
    expand: "توسّع فيه",
    persuasive: "اجعله أكثر إقناعًا",
    grammar: "صحّح الأخطاء اللغوية",
  },
  writing: "جارٍ الكتابة…",
  use: "اعتمد هذا النص",
  discard: "تجاهَل",
  adminOnly: "الكاتب الذكي متاح حاليًا لمسؤولي المنصة فقط.",
};
