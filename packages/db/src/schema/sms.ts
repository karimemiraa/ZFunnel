import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./tenancy";

/** Per-workspace Twilio credentials. The auth token is encrypted (see @zfunnel/email sealSecret). */
export const smsSettings = pgTable("sms_settings", {
  workspaceId: uuid()
    .primaryKey()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  provider: text().$type<"twilio">().notNull().default("twilio"),
  accountSid: text().notNull(),
  authTokenSealed: text().notNull(),
  fromNumber: text().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
