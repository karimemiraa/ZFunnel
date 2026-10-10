import type { Shape } from "../../core";
import type { booking as en } from "../en/booking";

export const booking: Shape<typeof en> = {
  metaTitle: "حجز موعد",
  minutes: {
    one: "دقيقة واحدة",
    two: "دقيقتان",
    few: "{count} دقائق",
    many: "{count} دقيقة",
    other: "{count} دقيقة",
  },
  booked: "تم تأكيد موعدك!",
  bookedFor: "{name} يوم {when}",
  confirmationSent: "أرسلنا تأكيد الحجز إلى بريدك الإلكتروني.",
  prevMonth: "الشهر السابق",
  nextMonth: "الشهر التالي",
  timesShownIn: "المواعيد معروضة بتوقيت {tz}",
  noTimes: "لا توجد مواعيد متاحة حاليًا.",
  back: "رجوع",
  enterDetails: "أدخل بياناتك",
  name: "الاسم",
  email: "البريد الإلكتروني",
  notes: "هل هناك ما تودّ أن نعرفه قبل الموعد؟ (اختياري)",
  booking: "جارٍ الحجز…",
  confirm: "تأكيد الحجز",
};
