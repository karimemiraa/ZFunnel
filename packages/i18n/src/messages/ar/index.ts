import type { Shape } from "../../core";
import type { en } from "../en";
import { account } from "./account";
import { affiliate } from "./affiliate";
import { affiliatesAdmin } from "./affiliatesAdmin";
import { blocks } from "./blocks";
import { blog } from "./blog";
import { booking } from "./booking";
import { checkout } from "./checkout";
import { common } from "./common";
import { community } from "./community";
import { courses } from "./courses";
import { emails } from "./emails";
import { errors } from "./errors";
import { forms } from "./forms";
import { nav } from "./nav";
import { orders } from "./orders";
import { overview } from "./overview";
import { products } from "./products";
import { settings } from "./settings";
import { shell } from "./shell";
import { site } from "./site";
import { store } from "./store";
import { webinar } from "./webinar";

export const ar: Shape<typeof en> = {
  account,
  affiliate,
  affiliatesAdmin,
  blocks,
  blog,
  booking,
  checkout,
  common,
  community,
  courses,
  emails,
  errors,
  forms,
  nav,
  orders,
  overview,
  products,
  settings,
  shell,
  site,
  store,
  webinar,
};
