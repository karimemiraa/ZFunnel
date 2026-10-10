import type { Shape } from "../../core";
import type { en } from "../en";
import { account } from "./account";
import { activity } from "./activity";
import { affiliate } from "./affiliate";
import { auth } from "./auth";
import { billing } from "./billing";
import { blocks } from "./blocks";
import { blog } from "./blog";
import { booking } from "./booking";
import { checkout } from "./checkout";
import { common } from "./common";
import { community } from "./community";
import { courses } from "./courses";
import { developers } from "./developers";
import { domains } from "./domains";
import { emails } from "./emails";
import { errors } from "./errors";
import { forms } from "./forms";
import { nav } from "./nav";
import { overview } from "./overview";
import { payments } from "./payments";
import { settings } from "./settings";
import { shell } from "./shell";
import { site } from "./site";
import { sms } from "./sms";
import { store } from "./store";
import { team } from "./team";
import { tracking } from "./tracking";
import { webinar } from "./webinar";
import { workspace } from "./workspace";

export const ar: Shape<typeof en> = {
  account,
  activity,
  affiliate,
  auth,
  billing,
  blocks,
  blog,
  booking,
  checkout,
  common,
  community,
  courses,
  developers,
  domains,
  emails,
  errors,
  forms,
  nav,
  overview,
  payments,
  settings,
  shell,
  site,
  sms,
  store,
  team,
  tracking,
  webinar,
  workspace,
};
