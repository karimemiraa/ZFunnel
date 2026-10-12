import { and, contacts, formSubmissions, funnelSteps, getDb, isNotNull, lt, withSystem, workflows } from "@zfunnel/db";

/**
 * Soft-deleted rows are kept this long so a mistake can still be undone by support, then
 * removed for good (ADR-026). Funnels and products are archived, not purged: orders and
 * reports keep pointing at them.
 */
export const PURGE_AFTER_DAYS = 30;
const DAY_MS = 86_400_000;

/** Anything deleted before this moment is purged. */
export function purgeCutoff(now: Date, days = PURGE_AFTER_DAYS) {
  return new Date(now.getTime() - days * DAY_MS);
}

/** Hard-deletes rows soft-deleted more than PURGE_AFTER_DAYS ago, across all workspaces. */
export async function purgeDeleted(now = new Date()) {
  const cutoff = purgeCutoff(now);
  return withSystem(getDb(), async (tx) => {
    const gone = (col: Parameters<typeof isNotNull>[0]) => and(isNotNull(col), lt(col, cutoff));
    const removed = {
      contacts: (await tx.delete(contacts).where(gone(contacts.deletedAt)).returning({ id: contacts.id })).length,
      funnelSteps: (await tx.delete(funnelSteps).where(gone(funnelSteps.deletedAt)).returning({ id: funnelSteps.id }))
        .length,
      workflows: (await tx.delete(workflows).where(gone(workflows.deletedAt)).returning({ id: workflows.id })).length,
      formResponses: (
        await tx.delete(formSubmissions).where(gone(formSubmissions.deletedAt)).returning({ id: formSubmissions.id })
      ).length,
    };
    return removed;
  });
}
