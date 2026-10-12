import { notifications, type NotificationType } from "./schema/notifications";
import type { Tx } from "./tenant";

export type NotifyInput = {
  workspaceId: string;
  type: NotificationType;
  entityId?: string | null;
  data?: Record<string, string | number | null>;
};

/**
 * Best-effort notification write inside the caller's transaction. It runs in a savepoint, so a
 * failure here never rolls back or blocks the order, lead, chat or booking that triggered it.
 */
export async function notify(tx: Tx, input: NotifyInput): Promise<void> {
  try {
    await tx.transaction((sp) =>
      sp.insert(notifications).values({
        workspaceId: input.workspaceId,
        type: input.type,
        entityId: input.entityId ?? null,
        data: input.data ?? {},
      }),
    );
  } catch (err) {
    console.error("[notify] skipped", input.type, err);
  }
}
