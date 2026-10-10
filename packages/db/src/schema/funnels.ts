import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { workspaces } from "./tenancy";

export const STEP_TYPES = ["optin", "sales", "checkout", "upsell", "downsell", "thankyou", "page"] as const;
export type StepType = (typeof STEP_TYPES)[number];

/** Opaque Puck page JSON (see @zfunnel/blocks PageData). */
export type PageJson = { root: unknown; content: unknown[]; zones?: unknown };

export const funnels = pgTable(
  "funnels",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text().notNull(),
    /** URL prefix on the workspace domain: /{slug}/{step-slug}. */
    slug: text().notNull(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("funnels_workspace_slug_uq").on(t.workspaceId, t.slug),
    index("funnels_workspace_idx").on(t.workspaceId),
  ],
);

export const funnelSteps = pgTable(
  "funnel_steps",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    funnelId: uuid()
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    name: text().notNull(),
    type: text().$type<StepType>().notNull(),
    slug: text().notNull(),
    position: integer().notNull().default(0),
    /** Where "next"/accept goes. Null = end of funnel. */
    nextStepId: uuid().references((): AnyPgColumn => funnelSteps.id, { onDelete: "set null" }),
    /** Where "No thanks" goes on upsell/downsell steps. */
    declineStepId: uuid().references((): AnyPgColumn => funnelSteps.id, { onDelete: "set null" }),
    mapX: real().notNull().default(0),
    mapY: real().notNull().default(0),
    draft: jsonb().$type<PageJson>().notNull(),
    draftUpdatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    publishedVersionId: uuid(),
    publishedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("funnel_steps_funnel_slug_uq").on(t.funnelId, t.slug),
    index("funnel_steps_funnel_position_idx").on(t.funnelId, t.position),
    index("funnel_steps_workspace_idx").on(t.workspaceId),
  ],
);

/** Immutable snapshots; the public renderer only ever reads these. */
export const pageVersions = pgTable(
  "page_versions",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    stepId: uuid()
      .notNull()
      .references(() => funnelSteps.id, { onDelete: "cascade" }),
    data: jsonb().$type<PageJson>().notNull(),
    createdBy: text().references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("page_versions_step_idx").on(t.stepId, t.createdAt.desc())],
);

export type Funnel = typeof funnels.$inferSelect;
export type FunnelStep = typeof funnelSteps.$inferSelect;
export type PageVersion = typeof pageVersions.$inferSelect;

/**
 * A/B split test challenger for a step. The step itself is variant "A"; each challenger has
 * its own draft and published version and gets `weight`% of new visitors.
 */
export const stepVariants = pgTable(
  "step_variants",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    stepId: uuid()
      .notNull()
      .references(() => funnelSteps.id, { onDelete: "cascade" }),
    name: text().notNull().default("B"),
    draft: jsonb().$type<PageJson>().notNull(),
    draftUpdatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    publishedVersionId: uuid().references(() => pageVersions.id, { onDelete: "set null" }),
    publishedAt: timestamp({ withTimezone: true }),
    /** Share of new visitors (0–100) sent to this variant. */
    weight: integer().notNull().default(50),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("step_variants_step_idx").on(t.stepId)],
);
export type StepVariant = typeof stepVariants.$inferSelect;
