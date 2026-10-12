import type { Shape } from "../../core";
import type { notifications as en } from "../en/notifications";

export const notifications: Shape<typeof en> = {
  title: "الإشعارات",
  open: "الإشعارات",
  unread: {
    zero: "لا إشعارات جديدة",
    one: "إشعار واحد لم تقرأه",
    two: "إشعاران لم تقرأهما",
    few: "{count} إشعارات لم تقرأها",
    many: "{count} إشعارًا لم تقرأه",
    other: "{count} إشعار لم تقرأه",
  },
  markAllRead: "عَلِّم الكل كمقروء",
  empty: "لا جديد الآن. ستظهر هنا الطلبات والعملاء المحتملون والرسائل فور وصولها.",
  viewAll: "افتح",
  order: "وصلك طلب جديد رقم {number} من {name}",
  orderNoName: "وصلك طلب جديد رقم {number}",
  paymentFailed: "تعذّر الدفع في الطلب رقم {number}",
  lead: "عميل محتمل جديد: {name}",
  leadForm: "عبّأ {name} نموذج «{form}»",
  chat: "رسالة جديدة من {name}",
  booking: "حجز {name} موعدًا في «{calendar}»",
  someone: "أحد الزوار",
};
