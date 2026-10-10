import { asc, chatSettings, conversationMessages, conversations, desc, eq, sql } from "@zfunnel/db";
import { getTranslator } from "@zfunnel/i18n";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { cn } from "@zfunnel/ui/lib/utils";
import { InboxIcon } from "lucide-react";
import Link from "next/link";
import { ChatSettingsDialog, EmptyThread, Thread } from "@/components/inbox/inbox";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/context";
import { inWorkspace } from "@/lib/funnels";
import { getFmt, getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await getT())("inbox.pageTitle") };
}

const sqlLatest = sql<string>`(select m.id from conversation_messages m where m.conversation_id = "conversations"."id" order by m.created_at desc limit 1)`;

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ c?: string; status?: string }>;
}) {
  const ctx = await requireWorkspace(params);
  const { c: selected, status: st } = await searchParams;
  const status = st === "closed" ? "closed" : "open";
  const ws = ctx.workspace.slug;
  const [t, f] = await Promise.all([getT(), getFmt()]);
  const data = await inWorkspace(ctx, async (tx) => {
    const [settings] = await tx.select().from(chatSettings);
    const list = await tx
      .select({
        c: conversations,
        last: conversationMessages.body,
      })
      .from(conversations)
      .leftJoin(
        conversationMessages,
        // Latest message per conversation, for the preview line.
        eq(conversationMessages.id, sqlLatest),
      )
      .where(eq(conversations.status, status))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(200);
    const current =
      selected && /^[0-9a-f-]{36}$/.test(selected)
        ? (await tx.select().from(conversations).where(eq(conversations.id, selected)))[0]
        : undefined;
    const messages = current
      ? await tx
          .select()
          .from(conversationMessages)
          .where(eq(conversationMessages.conversationId, current.id))
          .orderBy(asc(conversationMessages.createdAt))
      : [];
    return { settings, list, current, messages };
  });
  const href = (q: Record<string, string>) => `/${ws}/inbox?${new URLSearchParams({ status, ...q })}`;

  return (
    <>
      <PageHeader
        title={t("inbox.pageTitle")}
        description={t("inbox.pageDescription")}
        actions={
          <ChatSettingsDialog
            workspaceSlug={ws}
            initial={{
              enabled: data.settings?.enabled ?? false,
              greeting: data.settings?.greeting ?? getTranslator(ctx.workspace.siteLocale)("site.defaultGreeting"),
              color: data.settings?.color ?? "#4f46e5",
            }}
          />
        }
      />
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-3">
          <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
            {(["open", "closed"] as const).map((s) => (
              <Link
                key={s}
                href={`/${ws}/inbox?status=${s}`}
                className={cn(
                  "rounded-md px-3 py-1.5 font-medium capitalize transition-all",
                  status === s ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`inbox.status.${s}`)}
              </Link>
            ))}
          </div>
          {data.list.length === 0 ? (
            <EmptyState
              icon={<InboxIcon />}
              title={status === "open" ? t("inbox.noOpen") : t("inbox.noClosed")}
              description={data.settings?.enabled ? t("inbox.emptyEnabled") : t("inbox.emptyDisabled")}
            />
          ) : (
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {data.list.map(({ c, last }) => (
                <li key={c.id}>
                  <Link
                    href={href({ c: c.id })}
                    className={cn(
                      "block px-4 py-3 transition-colors hover:bg-muted/50",
                      selected === c.id && "bg-muted",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("truncate text-sm", c.unread ? "font-semibold" : "font-medium")}>
                        {c.name || c.email}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        {c.unread && <span className="size-2 rounded-full bg-primary" aria-label={t("inbox.unread")} />}
                        {f.timeAgo(c.lastMessageAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{last ?? ""}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
        {data.current ? (
          <Thread
            key={data.current.id}
            workspaceSlug={ws}
            conversation={{
              id: data.current.id,
              name: data.current.name,
              email: data.current.email,
              status: data.current.status,
              unread: data.current.unread,
              pageUrl: data.current.pageUrl,
            }}
            messages={data.messages.map((m) => ({
              id: m.id,
              sender: m.sender,
              body: m.body,
              at: m.createdAt.toISOString(),
            }))}
          />
        ) : (
          <EmptyThread />
        )}
      </div>
    </>
  );
}
