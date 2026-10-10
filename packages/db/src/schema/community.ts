import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { courses } from "./courses";
import { workspaces } from "./tenancy";

const ws = () =>
  uuid()
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

export const communitySpaces = pgTable(
  "community_spaces",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    name: text().notNull(),
    slug: text().notNull(),
    description: text().notNull().default(""),
    /** members: any signed-in contact · course: only students of courseId. */
    access: text().$type<"members" | "course">().notNull().default("members"),
    courseId: uuid().references(() => courses.id, { onDelete: "set null" }),
    position: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("community_spaces_ws_slug_uq").on(t.workspaceId, t.slug)],
);

export const communityPosts = pgTable(
  "community_posts",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    spaceId: uuid()
      .notNull()
      .references(() => communitySpaces.id, { onDelete: "cascade" }),
    /** Null when posted by the owner from the dashboard. */
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    authorName: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    pinned: boolean().notNull().default(false),
    hidden: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("community_posts_space_idx").on(t.spaceId, t.pinned, t.createdAt)],
);

export const communityComments = pgTable(
  "community_comments",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    postId: uuid()
      .notNull()
      .references(() => communityPosts.id, { onDelete: "cascade" }),
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    authorName: text().notNull(),
    body: text().notNull(),
    hidden: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("community_comments_post_idx").on(t.postId, t.createdAt)],
);
