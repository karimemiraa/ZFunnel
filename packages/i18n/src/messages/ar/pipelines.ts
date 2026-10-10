import type { Shape } from "../../core";
import type { pipelines as en } from "../en/pipelines";

export const pipelines: Shape<typeof en> = {
  pageTitle: "مسارات الصفقات",
  pageDescription: "تابع كل صفقة من أول تواصل حتى إتمام البيع.",
  emptyTitle: "أنشئ أول مسار صفقات",
  emptyDescription:
    "يأتي جاهزًا بمراحل معدّة مسبقًا (عميل محتمل جديد ← تم التواصل ← عرض سعر ← ربح/خسارة). اسحب الصفقات بينها بسهولة.",
  summary: "{open} مفتوحة · {won} رابحة",
  newPipeline: "مسار جديد",
  namePrompt: "اسم مسار الصفقات",
  defaultName: "مسار المبيعات",
  stages: {
    newLead: "عميل محتمل جديد",
    contacted: "تم التواصل",
    proposalSent: "أُرسل عرض السعر",
    won: "ربح",
    lost: "خسارة",
  },
  addDeal: "أضف صفقة",
  newDealIn: "صفقة جديدة في «{stage}»",
  dealAdded: "أُضيفت الصفقة",
  dealTitle: "العنوان",
  titlePlaceholder: "شركة أكمي: باقة التدريب",
  value: "القيمة ($)",
  contactEmail: "بريد جهة الاتصال",
  deleteDealAria: "حذف {title}",
  deleteDealConfirm: "هل تريد حذف الصفقة «{title}»؟",
  newStageName: "اسم المرحلة الجديدة",
  addStage: "أضف مرحلة",
  err: {
    stageName: "اكتب اسمًا للمرحلة",
    dealTitle: "اكتب عنوانًا للصفقة",
    dealTitleLong: "اجعل العنوان أقل من 120 حرفًا",
    dealValue: "أدخل قيمة صحيحة للصفقة",
    invalidEmail: "أدخل بريدًا صحيحًا لجهة الاتصال",
    stageNotFound: "لم نجد هذه المرحلة",
    invalidMove: "لا يمكن تنفيذ هذا النقل",
    cantMove: "لا يمكن نقل الصفقة إلى هناك",
  },
};
