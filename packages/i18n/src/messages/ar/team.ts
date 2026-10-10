import type { Shape } from "../../core";
import type { team as en } from "../en/team";

export const team: Shape<typeof en> = {
  members: "أعضاء الفريق",
  description: "جميع أعضاء {organization}. ستصل دعوات البريد الإلكتروني مع إطلاق إرسال البريد في المرحلة الثانية.",
  roles: { owner: "مالك", admin: "مشرف", member: "عضو" },
};
