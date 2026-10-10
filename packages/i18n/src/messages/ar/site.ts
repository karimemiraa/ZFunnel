import type { Shape } from "../../core";
import type { site as en } from "../en/site";

export const site: Shape<typeof en> = {
  notFound: "الصفحة غير موجودة",
  notFoundText: "هذه الصفحة غير موجودة أو لم تُنشر بعد.",
  unavailable: "هذا الموقع غير متاح حاليًا",
  unavailableText: "لا يمكن عرضه في الوقت الحالي، عاود زيارته لاحقًا.",
  nothingYet: "لم يُنشر أي محتوى هنا بعد.",
  chatWith: "محادثة مع {name}",
  replyTime: "نرد عادةً خلال ساعات قليلة، وتصلك إجابتنا على بريدك أيضًا.",
  yourName: "اسمك",
  yourEmail: "بريدك الإلكتروني",
  emailForReplies: "بريدك (لنرسل لك الرد)",
  message: "الرسالة",
  writeMessage: "اكتب رسالتك…",
  send: "إرسال",
  couldNotSend: "تعذّر الإرسال، حاول مرة أخرى.",
  openChat: "افتح المحادثة",
  closeChat: "أغلق المحادثة",
  defaultGreeting: "أهلًا بك 👋 كيف نقدر نساعدك؟",
};
