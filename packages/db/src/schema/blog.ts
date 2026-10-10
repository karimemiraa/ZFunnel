import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./tenancy";

export const posts = pgTable(
  "posts",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text().notNull(),
    slug: text().notNull(),
    excerpt: text().notNull().default(""),
    /** Sanitized HTML. */
    content: text().notNull().default(""),
    coverUrl: text(),
    seoTitle: text().notNull().default(""),
    seoDescription: text().notNull().default(""),
    status: text().$type<"draft" | "published">().notNull().default("draft"),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("posts_ws_slug_uq").on(t.workspaceId, t.slug),
    index("posts_published_idx").on(t.workspaceId, t.status, t.publishedAt),
  ],
);
export type Post = typeof posts.$inferSelect;
