import type { Shape } from "../../core";
import type { store as en } from "../en/store";

export const store: Shape<typeof en> = {
  shop: "المتجر",
  metaTitle: "المتجر · {name}",
  empty: "لا توجد منتجات معروضة حاليًا.",
  soldOut: "نفدت الكمية",
  left: {
    one: "بقيت قطعة واحدة فقط",
    two: "بقيت قطعتان فقط",
    few: "بقيت {count} قطع فقط",
    many: "بقيت {count} قطعة فقط",
    other: "بقيت {count} قطعة فقط",
  },
  backToShop: "→ متجر {name}",
  buyNow: "اشترِ الآن",
  checkout: "الدفع",
};
