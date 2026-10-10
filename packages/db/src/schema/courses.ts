import { boolean, index, integer, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { products } from "./commerce";
import { contacts } from "./contacts";
import { workspaces } from "./tenancy";

const ws = () =>
  uuid()
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

export const courses = pgTable(
  "courses",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    title: text().notNull(),
    slug: text().notNull(),
    description: text().notNull().default(""),
    imageUrl: text(),
    status: text().$type<"draft" | "published">().notNull().default("draft"),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("courses_ws_slug_uq").on(t.workspaceId, t.slug)],
);

/** Buying any of these products grants access to the course. */
export const courseProducts = pgTable(
  "course_products",
  {
    workspaceId: ws(),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.productId] }), index("course_products_product_idx").on(t.productId)],
);

export const courseModules = pgTable(
  "course_modules",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    title: text().notNull(),
    position: integer().notNull().default(0),
  },
  (t) => [index("course_modules_course_idx").on(t.courseId, t.position)],
);

export const courseLessons = pgTable(
  "course_lessons",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    moduleId: uuid()
      .notNull()
      .references(() => courseModules.id, { onDelete: "cascade" }),
    title: text().notNull(),
    position: integer().notNull().default(0),
    videoUrl: text(),
    /** Sanitized HTML. */
    content: text().notNull().default(""),
    /** Unlocks this many days after enrollment (0 = immediately). */
    dripDays: integer().notNull().default(0),
    freePreview: boolean().notNull().default(false),
  },
  (t) => [index("course_lessons_module_idx").on(t.moduleId, t.position)],
);

export const courseEnrollments = pgTable(
  "course_enrollments",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: ws(),
    courseId: uuid()
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    contactId: uuid()
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    source: text().$type<"purchase" | "manual" | "automation" | "api">().notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("course_enrollments_uq").on(t.courseId, t.contactId)],
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    workspaceId: ws(),
    lessonId: uuid()
      .notNull()
      .references(() => courseLessons.id, { onDelete: "cascade" }),
    contactId: uuid()
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    completedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.lessonId, t.contactId] }), index("lesson_progress_contact_idx").on(t.contactId)],
);

export type Course = typeof courses.$inferSelect;
export type CourseLesson = typeof courseLessons.$inferSelect;
