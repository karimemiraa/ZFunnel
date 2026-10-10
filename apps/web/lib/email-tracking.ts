import "server-only";

import { and, contactActivities, contacts, emailMessages, eq, getDb, isNull, sql, withSystem } from "@zfunnel/db";

/** Records an open/click (first time sets the timestamp; every time bumps the count). System context: anonymous request. */
export async function recordEngagement(messageId: string, kind: "open" | "click", url?: string) {
  await withSystem(getDb(), async (tx) => {
    const [m] = await tx
      .update(emailMessages)
      .set(
        kind === "open"
          ? {
              openCount: sql`${emailMessages.openCount} + 1`,
              openedAt: sql`coalesce(${emailMessages.openedAt}, now())`,
            }
          : {
              clickCount: sql`${emailMessages.clickCount} + 1`,
              clickedAt: sql`coalesce(${emailMessages.clickedAt}, now())`,
              // A click implies an open (images may be blocked).
              openedAt: sql`coalesce(${emailMessages.openedAt}, now())`,
            },
      )
      .where(eq(emailMessages.id, messageId))
      .returning();
    const first = kind === "open" ? m?.openCount === 1 : m?.clickCount === 1;
    if (m?.contactId && first)
      await tx.insert(contactActivities).values({
        workspaceId: m.workspaceId,
        contactId: m.contactId,
        type: kind === "open" ? "email_opened" : "email_clicked",
        body: m.subject,
        data: url ? { url } : undefined,
      });
  });
}

export async function unsubscribeByMessage(messageId: string) {
  return withSystem(getDb(), async (tx) => {
    const [m] = await tx.select().from(emailMessages).where(eq(emailMessages.id, messageId));
    if (!m?.contactId) return null;
    const [c] = await tx
      .update(contacts)
      .set({ unsubscribedAt: sql`now()` })
      .where(and(eq(contacts.id, m.contactId), isNull(contacts.unsubscribedAt)))
      .returning({ id: contacts.id });
    if (c)
      await tx
        .insert(contactActivities)
        .values({ workspaceId: m.workspaceId, contactId: c.id, type: "unsubscribed", body: m.subject });
    return m;
  });
}
