import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { contacts } from "./contacts";
import { funnels, funnelSteps } from "./funnels";
import { workspaces } from "./tenancy";

/** `type` is the question type (single_choice, short_text…), kept so reports can chart choices. */
export type FormAnswer = { key: string; label: string; type?: string; value: string | string[] };

/** One submission of a Form / survey / quiz block. A form is identified by its step + block id. */
export const formSubmissions = pgTable(
  "form_submissions",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    funnelId: uuid().references(() => funnels.id, { onDelete: "set null" }),
    stepId: uuid().references(() => funnelSteps.id, { onDelete: "set null" }),
    blockId: text().notNull(),
    formName: text().notNull(),
    contactId: uuid().references(() => contacts.id, { onDelete: "set null" }),
    answers: jsonb().$type<FormAnswer[]>().notNull(),
    score: integer(),
    outcome: text(),
    /** Soft delete (ADR-026): set on every response when a form is deleted from the Forms list. */
    deletedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("form_submissions_form_idx").on(t.workspaceId, t.stepId, t.blockId, t.createdAt)],
);
export type FormSubmission = typeof formSubmissions.$inferSelect;
