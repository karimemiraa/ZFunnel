/**
 * Default block text for Arabic sites, written natively (not translated) so a block dropped onto an
 * Arabic page starts with copy an Arab marketer would actually use. Keys mirror each block's defaultProps.
 */
export const AR_DEFAULTS: Record<string, Record<string, unknown>> = {
  Heading: { text: "حوّل زوّارك إلى عملاء" },
  Text: {
    text: "<p>احكِ لعميلك ما الذي سيتغير في حياته بعد عرضك. اجعلها جملًا قصيرة وواضحة، وتحدّث عنه هو لا عنك.</p>",
  },
  Badge: { text: "دورة جديدة" },
  Button: { label: "نعم! أريد هذا العرض" },
  Checklist: {
    items: [
      { text: "دروس فيديو خطوة بخطوة" },
      { text: "قوالب جاهزة تطبّقها من اليوم" },
      { text: "وصول مدى الحياة مع كل التحديثات" },
    ],
  },
  Features: {
    items: [
      { icon: "zap", title: "انطلق خلال أيام", text: "قوالب مجرّبة، فلن تبدأ أبدًا من صفحة بيضاء." },
      { icon: "target", title: "مصمَّم ليبيع", text: "كل قسم مبني على ما تفعله أنجح الأقماع اليوم." },
      { icon: "chart", title: "أرقامك أمامك", text: "اعرف بدقة أي خطوة تجلب لك المال." },
    ],
  },
  Testimonials: {
    items: [
      {
        quote: "استرجعت ما دفعته خلال الأسبوع الأول. القوالب وحدها تستحق السعر.",
        name: "سارة العتيبي",
        role: "مدرّبة أونلاين",
        avatar: "",
      },
      {
        quote: "أخيرًا قمع مبيعات بمظهر احترافي دون الحاجة إلى مصمم.",
        name: "خالد المنصوري",
        role: "صاحب وكالة تسويق",
        avatar: "",
      },
      {
        quote: "ارتفع معدل التحويل في صفحة الدفع من 2.1% إلى 4.8% خلال شهر واحد.",
        name: "نور حداد",
        role: "مؤسِّسة متجر إلكتروني",
        avatar: "",
      },
    ],
  },
  Faq: {
    items: [
      {
        question: "إلى متى يبقى المحتوى متاحًا لي؟",
        answer: "مدى الحياة، ومعه كل التحديثات القادمة دون أي تكلفة إضافية.",
      },
      { question: "هل يوجد ضمان؟", answer: "نعم. إن لم يناسبك المحتوى، راسلنا خلال 30 يومًا ونعيد لك المبلغ كاملًا." },
      { question: "هل أحتاج إلى خبرة سابقة؟", answer: "إطلاقًا. نشرح كل شيء خطوة بخطوة ونبدأ معك من الصفر." },
    ],
  },
  Pricing: {
    plans: [
      {
        name: "الأساسية",
        price: "$47",
        period: "",
        description: "كل ما تحتاجه لتبدأ",
        features: "الدورة الأساسية\nكتيّب التطبيق\nالانضمام إلى المجتمع",
        cta: "اشترك في الأساسية",
        highlighted: false,
      },
      {
        name: "الاحترافية",
        price: "$197",
        period: "",
        description: "الباقة الأكثر طلبًا",
        features: "كل ما في الأساسية\nقوالب جاهزة للتنفيذ\nجلسة أسئلة مباشرة شهريًا\nدعم بأولوية",
        cta: "اشترك في الاحترافية",
        highlighted: true,
      },
    ],
  },
  LogoBar: {
    title: "تحدّثوا عنّا",
    // Placeholder publication names; the owner replaces them with real logos.
    logos: [
      { name: "مجلة الأعمال", image: "" },
      { name: "رواد", image: "" },
      { name: "عالم التقنية", image: "" },
      { name: "الاقتصاد اليوم", image: "" },
    ],
  },
  Guarantee: {
    title: "ضمان استرداد كامل 100%",
    text: "جرّب دون أي مخاطرة. إن لم تكن راضيًا خلال 30 يومًا، راسلنا ونعيد لك كل ريال دفعته، دون أسئلة.",
  },
  Stats: {
    items: [
      { value: "+12,400", label: "طالب وطالبة" },
      { value: "4.9/5", label: "متوسط التقييم" },
      { value: "$2.3M", label: "أرباح حققها أعضاؤنا" },
    ],
  },
  ProgressBar: { label: "الخطوة 1 من 2: أوشكت على الانتهاء!" },
  Countdown: { expiredText: "انتهى هذا العرض." },
  OptInForm: {
    buttonLabel: "أرسلوا لي الدليل المجاني",
    privacyNote: "نحترم خصوصيتك، ويمكنك إلغاء الاشتراك متى شئت.",
    successMessage: "شكرًا لك! تفقّد بريدك الوارد.",
  },
  Survey: {
    formName: "استبيان",
    questions: [
      {
        label: "ما هدفك الأهم الآن؟",
        type: "single_choice",
        required: true,
        options: "جذب عملاء محتملين أكثر\nزيادة المبيعات\nإطلاق منتج جديد",
        saveTo: "goal",
      },
      {
        label: "ما حجم نشاطك التجاري؟",
        type: "single_choice",
        required: true,
        options: "أعمل وحدي\nمن 2 إلى 10 أشخاص\nأكثر من 10 أشخاص",
        saveTo: "",
      },
    ],
    buttonLabel: "اعرض نتيجتي",
    successMessage: "شكرًا لك! وصلتنا إجاباتك.",
  },
  OrderForm: {
    contactTitle: "بياناتك",
    paymentTitle: "الدفع",
    buttonLabel: "أكمل طلبي",
    guarantee: "ضمان استرداد خلال 30 يومًا",
  },
  UpsellOffer: {
    acceptLabel: "نعم! أضف هذا إلى طلبي",
    acceptSublabel: "بنقرة واحدة، دون إعادة إدخال بطاقتك",
    declineLabel: "لا شكرًا، سأفوّت هذا العرض",
  },
};
