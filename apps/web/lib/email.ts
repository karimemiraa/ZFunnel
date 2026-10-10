import "server-only";

import {
  and,
  broadcasts,
  contacts,
  desc,
  emailMessages,
  emails,
  emailSettings,
  eq,
  isNull,
  segmentCondition,
  segments,
  sql,
} from "@zfunnel/db";
import { starterEmail } from "@zfunnel/email/editor";
import { getTranslator, type Locale } from "@zfunnel/i18n";
import { inWorkspace } from "./funnels";
import type { WorkspaceContext } from "./workspaces";

export async function getEmailSettings(ctx: WorkspaceContext) {
  const [s] = await inWorkspace(ctx, (tx) => tx.select().from(emailSettings));
  return s ?? null;
}

export async function listBroadcasts(ctx: WorkspaceContext) {
  return inWorkspace(ctx, (tx) =>
    tx
      .select({
        b: broadcasts,
        name: emails.name,
        subject: emails.subject,
        sent: sql<number>`(select count(*)::int from email_messages m where m.broadcast_id = "broadcasts"."id" and m.status = 'sent')`,
        opened: sql<number>`(select count(*)::int from email_messages m where m.broadcast_id = "broadcasts"."id" and m.opened_at is not null)`,
        clicked: sql<number>`(select count(*)::int from email_messages m where m.broadcast_id = "broadcasts"."id" and m.clicked_at is not null)`,
      })
      .from(broadcasts)
      .innerJoin(emails, eq(emails.id, broadcasts.emailId))
      .orderBy(desc(broadcasts.createdAt)),
  );
}

export async function getBroadcast(ctx: WorkspaceContext, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return inWorkspace(ctx, async (tx) => {
    const [row] = await tx
      .select({ b: broadcasts, email: emails })
      .from(broadcasts)
      .innerJoin(emails, eq(emails.id, broadcasts.emailId))
      .where(eq(broadcasts.id, id));
    if (!row) return null;
    const [stats] = await tx
      .select({
        total: sql<number>`count(*)::int`,
        sent: sql<number>`count(*) filter (where ${emailMessages.status} = 'sent')::int`,
        failed: sql<number>`count(*) filter (where ${emailMessages.status} in ('failed','bounced'))::int`,
        opened: sql<number>`count(*) filter (where ${emailMessages.openedAt} is not null)::int`,
        clicked: sql<number>`count(*) filter (where ${emailMessages.clickedAt} is not null)::int`,
      })
      .from(emailMessages)
      .where(eq(emailMessages.broadcastId, id));
    return { ...row, stats: stats! };
  });
}

/** How many contacts a broadcast would reach (unsubscribed excluded). */
export async function audienceCount(
  ctx: WorkspaceContext,
  audience: { segmentId?: string | null; tag?: string | null },
) {
  return inWorkspace(ctx, async (tx) => {
    const [seg] = audience.segmentId ? await tx.select().from(segments).where(eq(segments.id, audience.segmentId)) : [];
    const [r] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(contacts)
      .where(
        and(
          isNull(contacts.unsubscribedAt),
          seg ? segmentCondition(seg.match, seg.rules) : undefined,
          audience.tag ? segmentCondition("all", [{ field: "tag", op: "has", value: audience.tag }]) : undefined,
        ),
      );
    return r?.n ?? 0;
  });
}

export async function getEmailDesign(ctx: WorkspaceContext, emailId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(emailId)) return null;
  const [e] = await inWorkspace(ctx, (tx) => tx.select().from(emails).where(eq(emails.id, emailId)));
  return e ?? null;
}

/** The starter email design, with its copy written in the workspace's site language. */
export function localizedStarterEmail(locale: Locale) {
  const doc = starterEmail();
  if (locale === "en") return doc;
  const t = getTranslator(locale);
  const copy = [
    t("email.starter.heading"),
    t("email.starter.body"),
    t("email.starter.button"),
    t("email.starter.signoff"),
  ];
  return {
    ...doc,
    // The renderer mirrors alignment for RTL site languages, so only the copy changes.
    content: doc.content.map((block, i) => ({
      ...block,
      props: { ...block.props, ...(block.type === "Button" ? { label: copy[i] } : { text: copy[i] }) },
    })),
  };
}
