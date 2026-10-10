import type { Shape } from "../../core";
import type { auth as en } from "../en/auth";

export const auth: Shape<typeof en> = {
  signInTitle: "تسجيل الدخول",
  createAccountTitle: "إنشاء حساب",
  createYourAccount: "أنشئ حسابك",
  welcomeBack: "أهلًا بعودتك",
  signUpSubtitle: "ابدأ ببناء أقماع المبيعات خلال دقائق.",
  signInSubtitle: "سجّل الدخول إلى حسابك في ZFunnel.",
  fullName: "الاسم الكامل",
  email: "البريد الإلكتروني",
  password: "كلمة المرور",
  passwordHint: "10 أحرف على الأقل.",
  createAccount: "إنشاء حساب",
  signIn: "تسجيل الدخول",
  haveAccount: "لديك حساب بالفعل؟ ",
  newHere: "جديد على ZFunnel؟ ",
  createAnAccount: "أنشئ حسابًا",
  invalidCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  userExists: "يوجد حساب مسجّل بهذا البريد الإلكتروني بالفعل.",
  passwordTooShort: "كلمة المرور قصيرة جدًا",
  notFoundTitle: "الصفحة غير موجودة",
  notFoundBody: "ربما نُقلت إلى مكان آخر، أو ليست لديك صلاحية الوصول إليها.",
  goToDashboard: "الذهاب إلى لوحة التحكم",
};
