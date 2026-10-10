import type { Shape } from "../../core";
import type { activity as en } from "../en/activity";

export const activity: Shape<typeof en> = {
  description: "سجل بالتغييرات التي أُجريت في مساحة العمل هذه.",
  empty: "لا يوجد نشاط بعد",
  someone: "أحد الأعضاء",
  actions: {
    created: "أنشأ مساحة العمل",
    renamed: "غيّر اسم مساحة العمل",
  },
  renamedTo: " إلى «{name}»",
};
