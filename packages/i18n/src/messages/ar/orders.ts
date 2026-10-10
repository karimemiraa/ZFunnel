import type { Shape } from "../../core";
import type { orders as en } from "../en/orders";

export const orders: Shape<typeof en> = {
  title: "الطلبات",
  description: "كل عملية شراء عبر أقماع مبيعاتك، بما فيها عروض الترقية بنقرة واحدة.",
  customerCenter: "مركز العملاء",
  totalRevenue: "إجمالي الإيرادات",
  last30: "آخر 30 يومًا",
  paidOrders: "الطلبات المدفوعة",
  avgPerOrder: "بمتوسط {amount} للطلب",
  activeSubscriptions: "الاشتراكات النشطة",
  filters: { all: "الكل", paid: "مدفوعة", pending: "قيد الانتظار", failed: "فاشلة", refunded: "مستردّة" },
  searchPlaceholder: "ابحث بالاسم أو البريد أو رقم الطلب",
  noMatching: "لا توجد طلبات مطابقة",
  noOrders: "لا توجد طلبات بعد",
  emptyDescription: "ستظهر الطلبات هنا فور أن يشتري أحدهم عبر أي من أقماع مبيعاتك.",
  colOrder: "الطلب",
  colCustomer: "العميل",
  colItems: "المنتجات",
  colStatus: "الحالة",
  colTotal: "الإجمالي",
  shipTo: "📦 الشحن إلى {city}، {country}",
  roles: { main: "رئيسي", bump: "عرض إضافي", upsell: "ترقية", downsell: "عرض بديل" },
  status: {
    paid: "مدفوع",
    pending: "قيد الانتظار",
    failed: "فشل الدفع",
    refunded: "مسترد",
    partially_refunded: "مسترد جزئيًا",
  },
  test: "تجريبي",
};
