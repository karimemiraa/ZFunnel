import { customType, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { workspaces } from "./tenancy";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/**
 * Images copied into ZFunnel (e.g. by the ClickFunnels importer), served from the public site at
 * /api/media/{id}. Kept in Postgres for now: imports are small and capped (ADR-024).
 */
export const mediaFiles = pgTable(
  "media_files",
  {
    id: uuid().primaryKey().defaultRandom(),
    workspaceId: uuid()
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    contentType: text().notNull(),
    size: integer().notNull(),
    /** SHA-256 of the bytes, so the same image imported twice is stored once. */
    sha256: text().notNull(),
    data: bytea().notNull(),
    sourceUrl: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("media_files_ws_sha_uq").on(t.workspaceId, t.sha256),
    index("media_files_ws_idx").on(t.workspaceId),
  ],
);
