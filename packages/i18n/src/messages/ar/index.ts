import type { Shape } from "../../core";
import type { en } from "../en";
import { account } from "./account";
import { affiliate } from "./affiliate";
import { automations } from "./automations";
import { blocks } from "./blocks";
import { blog } from "./blog";
import { booking } from "./booking";
import { checkout } from "./checkout";
import { common } from "./common";
import { community } from "./community";
import { courses } from "./courses";
import { email } from "./email";
import { emails } from "./emails";
import { errors } from "./errors";
import { forms } from "./forms";
import { nav } from "./nav";
import { overview } from "./overview";
import { settings } from "./settings";
import { shell } from "./shell";
import { site } from "./site";
import { store } from "./store";
import { webinar } from "./webinar";

export const ar: Shape<typeof en> = {
  account,
  affiliate,
  automations,
  blocks,
  blog,
  booking,
  checkout,
  common,
  community,
  courses,
  email,
  emails,
  errors,
  forms,
  nav,
  overview,
  settings,
  shell,
  site,
  store,
  webinar,
};
