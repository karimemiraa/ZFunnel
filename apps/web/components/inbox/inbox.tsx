"use client";

import { Button } from "@zfunnel/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@zfunnel/ui/dialog";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { Textarea } from "@zfunnel/ui/textarea";
import { toast } from "@zfunnel/ui/toaster";
import { CheckCircle2Icon, Loader2Icon, MessageCircleIcon, RotateCcwIcon, SendIcon, Settings2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  markConversationRead,
  replyToConversation,
  saveChatSettings,
  setConversationStatus,
} from "@/lib/inbox-actions";

type Result = { ok: true; message?: string } | { ok: false; error: string };

function useRun() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const run = (fn: () => Promise<Result>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) toast.error(r.error);
      else {
        if (r.message) toast.success(r.message);
        after?.();
        router.refresh();
      }
    });
  return { busy, run };
}

export function ChatSettingsDialog({
  workspaceSlug,
  initial,
}: {
  workspaceSlug: string;
  initial: { enabled: boolean; greeting: string; color: string };
}) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(initial);
  const { busy, run } = useRun();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings2Icon /> Chat widget{" "}
          <span className={initial.enabled ? "text-emerald-600" : "text-muted-foreground"}>
            · {initial.enabled ? "On" : "Off"}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Site chat widget</DialogTitle>
          <DialogDescription>
            A chat bubble on every page of your site. Messages land here, and your replies are emailed to the visitor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={v.enabled}
              onChange={(e) => setV({ ...v, enabled: e.target.checked })}
            />
            Show the chat bubble on my site
          </label>
          <div className="space-y-2">
            <Label htmlFor="chat-greeting">Greeting</Label>
            <Textarea
              id="chat-greeting"
              rows={2}
              value={v.greeting}
              onChange={(e) => setV({ ...v, greeting: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chat-color">Brand color</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Pick a color"
                value={v.color}
                onChange={(e) => setV({ ...v, color: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border bg-transparent"
              />
              <Input id="chat-color" value={v.color} onChange={(e) => setV({ ...v, color: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={busy}
            onClick={() =>
              run(
                () => saveChatSettings(workspaceSlug, v),
                () => setOpen(false),
              )
            }
          >
            {busy && <Loader2Icon className="animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Thread({
  workspaceSlug,
  conversation,
  messages,
}: {
  workspaceSlug: string;
  conversation: {
    id: string;
    name: string;
    email: string;
    status: "open" | "closed";
    unread: boolean;
    pageUrl: string;
  };
  messages: { id: string; sender: "visitor" | "owner"; body: string; at: string }[];
}) {
  const [text, setText] = useState("");
  const { busy, run } = useRun();
  const router = useRouter();
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversation.id]);
  useEffect(() => {
    if (conversation.unread) void markConversationRead(workspaceSlug, conversation.id).then(() => router.refresh());
  }, [conversation.id, conversation.unread, workspaceSlug, router]);
  // New visitor messages show up without reloading.
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 15_000);
    return () => clearInterval(t);
  }, [router]);

  const closed = conversation.status === "closed";
  return (
    <section className="flex min-h-[560px] flex-col rounded-xl border bg-card">
      <header className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <div className="min-w-0">
          <p className="truncate font-semibold">{conversation.name || conversation.email}</p>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.email}
            {conversation.pageUrl && ` · started on ${conversation.pageUrl.replace(/^https?:\/\//, "")}`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => run(() => setConversationStatus(workspaceSlug, conversation.id, closed ? "open" : "closed"))}
        >
          {closed ? <RotateCcwIcon /> : <CheckCircle2Icon />} {closed ? "Reopen" : "Close"}
        </Button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto bg-muted/30 p-5 text-sm">
        {messages.map((m) => (
          <div key={m.id} className={m.sender === "owner" ? "flex justify-end" : "flex"}>
            <div className="max-w-[75%]">
              <p
                className={
                  m.sender === "owner"
                    ? "rounded-2xl rounded-ee-sm bg-primary px-3.5 py-2 whitespace-pre-wrap text-primary-foreground"
                    : "rounded-2xl rounded-es-sm border bg-background px-3.5 py-2 whitespace-pre-wrap"
                }
              >
                {m.body}
              </p>
              <p className={`mt-1 text-[11px] text-muted-foreground ${m.sender === "owner" ? "text-end" : ""}`}>
                {new Date(m.at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => replyToConversation(workspaceSlug, conversation.id, text),
            () => setText(""),
          );
        }}
      >
        <Textarea
          aria-label="Reply"
          rows={2}
          placeholder={`Reply to ${conversation.name || conversation.email}… (also sent by email)`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
          className="min-h-0 flex-1 resize-none"
        />
        <Button type="submit" disabled={busy || !text.trim()}>
          {busy ? <Loader2Icon className="animate-spin" /> : <SendIcon />} Send
        </Button>
      </form>
    </section>
  );
}

export function EmptyThread() {
  return (
    <div className="flex min-h-[560px] flex-col items-center justify-center rounded-xl border border-dashed text-center text-sm text-muted-foreground">
      <MessageCircleIcon className="mb-3 size-8" />
      Pick a conversation to read and reply.
    </div>
  );
}
