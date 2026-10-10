import type { Shape } from "../../core";
import type { blog as en } from "../en/blog";

export const blog: Shape<typeof en> = {
  blog: "المدونة",
  metaTitle: "المدونة · {name}",
  empty: "لا توجد مقالات منشورة بعد.",
  rss: "خلاصة RSS",
  back: "→ مدونة {name}",
  feedDescription: "مدونة {name}",
};
