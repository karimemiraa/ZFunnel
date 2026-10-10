import type { Shape } from "../../core";
import type { community as en } from "../en/community";

export const community: Shape<typeof en> = {
  title: "المجتمع",
  siteCommunity: "مجتمع {site}",
  signIn: "سجّل دخولك وشاركنا النقاش.",
  noSpaces: "لا توجد مساحات نقاش متاحة لك حاليًا.",
  courses: "الدورات",
  spaces: "المساحات",
  pinned: "مثبّت",
  replies: {
    zero: "لا ردود بعد",
    one: "رد واحد",
    two: "ردّان",
    few: "{count} ردود",
    many: "{count} ردًا",
    other: "{count} رد",
  },
  back: "→ # {space}",
  startDiscussion: "ابدأ نقاشًا جديدًا…",
  titlePlaceholder: "العنوان",
  postTitle: "عنوان المنشور",
  bodyPlaceholder: "بماذا تفكر؟",
  postBody: "نص المنشور",
  posting: "جارٍ النشر…",
  post: "انشر",
  writeReply: "اكتب ردك…",
  reply: "ردّ",
  sending: "جارٍ الإرسال…",
};
