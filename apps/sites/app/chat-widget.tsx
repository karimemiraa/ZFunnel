"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Msg = { id: string; sender: "visitor" | "owner"; body: string; createdAt: string };
type Cfg = { enabled: true; name: string; greeting: string; color: string; started: boolean; messages: Msg[] };

/** Floating site chat. Loads lazily; renders nothing when the workspace has chat turned off. */
export function ChatWidget() {
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/chat", { cache: "no-store" }).catch(() => null);
    const d = (await r?.json().catch(() => null)) as Cfg | { enabled: false } | null;
    if (d?.enabled) setCfg(d);
  }, []);

  useEffect(() => {
    // Not inside the editor preview / share pages.
    if (window.self !== window.top || location.pathname.startsWith("/share/")) return;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!open || !cfg?.started) return;
    const t = setInterval(() => void load(), 8_000);
    return () => clearInterval(t);
  }, [open, cfg?.started, load]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [cfg?.messages.length, open]);

  if (!cfg) return null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError("");
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        body: text,
        ...(cfg.started ? {} : { name: name || undefined, email, pageUrl: location.href.slice(0, 500) }),
      }),
    }).catch(() => null);
    const d = (await r?.json().catch(() => null)) as { error?: string } | null;
    setSending(false);
    if (!r?.ok) return setError(d?.error ?? "Couldn't send. Please try again.");
    setText("");
    await load();
  };

  return (
    <div className="fixed right-4 bottom-4 z-[9999] flex flex-col items-end gap-3 font-sans text-zinc-900">
      {open && (
        <div
          role="dialog"
          aria-label={`Chat with ${cfg.name}`}
          className="flex h-[min(560px,calc(100dvh-6rem))] w-[min(370px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
        >
          <div className="px-5 py-4 text-white" style={{ background: cfg.color }}>
            <p className="font-semibold">{cfg.name}</p>
            <p className="text-sm opacity-90">We usually reply within a few hours, by email too.</p>
          </div>
          <div ref={list} className="flex-1 space-y-2 overflow-y-auto bg-zinc-50 p-4 text-sm">
            <Bubble mine={false} color={cfg.color}>
              {cfg.greeting}
            </Bubble>
            {cfg.messages.map((m) => (
              <Bubble key={m.id} mine={m.sender === "visitor"} color={cfg.color}>
                {m.body}
              </Bubble>
            ))}
          </div>
          <form onSubmit={send} className="space-y-2 border-t border-zinc-200 bg-white p-3">
            {!cfg.started && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  aria-label="Your name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                />
                <input
                  aria-label="Your email"
                  type="email"
                  required
                  placeholder="Email (for replies)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                />
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                aria-label="Message"
                rows={1}
                placeholder="Write a message…"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
                className="flex-1 resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
              />
              <button
                type="submit"
                disabled={sending}
                className="rounded-lg px-4 text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: cfg.color }}
              >
                Send
              </button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </form>
        </div>
      )}
      <button
        type="button"
        aria-label={open ? "Close chat" : "Open chat"}
        onClick={() => setOpen((o) => !o)}
        className="flex size-14 items-center justify-center rounded-full text-white shadow-xl transition hover:scale-105"
        style={{ background: cfg.color }}
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          ) : (
            <path
              d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>
    </div>
  );
}

function Bubble({ mine, color, children }: { mine: boolean; color: string; children: React.ReactNode }) {
  return (
    <div className={mine ? "flex justify-end" : "flex"}>
      <p
        className={`max-w-[80%] rounded-2xl px-3.5 py-2 whitespace-pre-wrap ${mine ? "text-white" : "bg-white shadow-sm ring-1 ring-black/5"}`}
        style={mine ? { background: color } : undefined}
      >
        {children}
      </p>
    </div>
  );
}
