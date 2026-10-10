import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { funnels } from "./funnels";
import { workspaces } from "./tenancy";

export type DomainStatus = "pending" | "active" | "failed";

/** A customer's own domain (e.g. offer.acme.com) pointing at the public renderer. */
export const domains = pgTable(
  "domains",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    /** Lower-case, no port, globally unique across all workspaces. */
    hostname: text().notNull().unique(),
    /** Optional: show this funnel at "/" on this domain (else the workspace homepage). */
    funnelId: uuid().references(() => funnels.id, { onDelete: "set null" }),
    status: text().$type<DomainStatus>().notNull().default("pending"),
    /** Proves ownership: TXT record _zfunnel.{hostname} = this token. */
    verificationToken: text().notNull(),
    verifiedAt: timestamp({ withTimezone: true }),
    lastCheckedAt: timestamp({ withTimezone: true }),
    lastError: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("domains_workspace_idx").on(t.workspaceId)],
);

export type Domain = typeof domains.$inferSelect;
