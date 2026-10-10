import type { Shape } from "../../core";
import type { courses as en } from "../en/courses";

export const courses: Shape<typeof en> = {
  myCourses: "دوراتي",
  memberArea: "منطقة الأعضاء",
  signInIntro: "سجّل دخولك بالبريد الذي اشتريت به، وسنرسل لك رابط دخول آمنًا.",
  account: "حسابي",
  none: "لا توجد لديك دورات بعد.",
  lessonsProgress: {
    one: "أكملت {completed} من درس واحد · {percent}%",
    two: "أكملت {completed} من درسين · {percent}%",
    few: "أكملت {completed} من {count} دروس · {percent}%",
    many: "أكملت {completed} من {count} درسًا · {percent}%",
    other: "أكملت {completed} من {count} درس · {percent}%",
  },
  percentComplete: "أنجزت {percent}%",
  continue: "تابع من حيث توقفت ←",
  start: "ابدأ الدورة ←",
  noAccess: "لا تملك صلاحية الوصول إلى هذه الدورة بعد. يمكنك مشاهدة الدروس التجريبية المجانية من القائمة.",
  alreadyBought: "اشتريتها من قبل؟ سجّل دخولك وابدأ التعلّم.",
  previous: "→ الدرس السابق",
  next: "الدرس التالي ←",
  completed: "أنجزته",
  completeContinue: "أنجزته، إلى الدرس التالي",
  markComplete: "تحديد كمُنجَز",
};
