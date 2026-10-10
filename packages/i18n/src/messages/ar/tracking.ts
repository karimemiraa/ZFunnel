import type { Shape } from "../../core";
import type { tracking as en } from "../en/tracking";

export const tracking: Shape<typeof en> = {
  platforms: {
    meta: {
      title: "Meta Conversions API",
      description:
        "ترسل أحداث Lead وPurchase إلى إعلانات فيسبوك وإنستغرام من الخادم مباشرة، فلا تستطيع أدوات حجب الإعلانات إخفاء مبيعاتك.",
      idLabel: "معرّف البكسل (مجموعة البيانات)",
      idHint: "Events Manager ← Data sources ← البكسل الخاص بك",
      tokenLabel: "رمز الوصول",
    },
    tiktok: {
      title: "TikTok Events API",
      description: "ترسل أحداث SubmitForm وCompletePayment إلى إعلانات TikTok.",
      idLabel: "رمز البكسل",
      idHint: "TikTok Ads Manager ← Events ← Web events",
      tokenLabel: "رمز الوصول",
    },
    ga4: {
      title: "Google Analytics 4",
      description:
        "ترسل أحداث generate_lead وpurchase عبر Measurement Protocol، ويمكنك استيرادها إلى Google Ads كتحويلات.",
      idLabel: "معرّف القياس (Measurement ID)",
      idHint: "Admin ← Data streams ← مصدر بيانات موقعك",
      tokenLabel: "المفتاح السري لـ Measurement Protocol",
    },
  },
  connected: "مرتبط",
  keepPlaceholder: "•••••••• محفوظ (اتركه فارغًا للإبقاء عليه)",
  storedEncrypted: "يُحفظ مشفّرًا ولن يظهر مرة أخرى.",
  testCode: "رمز حدث الاختبار (اختياري)",
  testCodeHint: "ستظهر الأحداث حينها ضمن «Test events». احذفه عند الانتقال إلى التشغيل الفعلي.",
  disconnectConfirm: "هل تريد فصل {name}؟ سيتوقف إرسال التحويلات.",
  disconnect: "فصل",
  connect: "ربط",
  recent: "أحدث أحداث الخادم",
  recentHint:
    "الاشتراكات والمشتريات المرسلة إلى منصاتك الإعلانية. نشفّر عناوين البريد وأرقام الهواتف (SHA-256) قبل أن تغادر ZFunnel.",
  nothing: "لم يُرسل أي شيء بعد.",
  colPlatform: "المنصة",
  colEvent: "الحدث",
  colEventId: "معرّف الحدث",
  colStatus: "الحالة",
  colWhen: "التوقيت",
  sent: "أُرسل",
  retrying: "إعادة المحاولة",
  failed: "فشل",
  onlyAdmins: "تعديل إعدادات التتبّع متاح للمالكين والمشرفين فقط.",
  checkFields: "راجع الحقول ثم حاول مرة أخرى.",
  idRules: {
    meta: "معرّف بكسل Meta (مجموعة البيانات) رقم من 15 إلى 16 خانة.",
    tiktok: "رمز بكسل TikTok يشبه CABCDEFG1234567890.",
    ga4: "معرّف القياس في GA4 يشبه G-ABC123XYZ.",
  },
  enterSecret: "أدخل المفتاح السري لـ Measurement Protocol.",
  enterToken: "أدخل رمز الوصول.",
  connectedMessage: "تم ربط {name}",
  disconnectedMessage: "تم فصل {name}",
};
