"use client";

import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { toast } from "@zfunnel/ui/toaster";
import { CheckIcon, CopyIcon, KeyRoundIcon, Loader2Icon, SendIcon, Trash2Icon, WebhookIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  createApiKey,
  createWebhook,
  deleteWebhook,
  revokeApiKey,
  sendTestWebhook,
  setWebhookStatus,
} from "@/lib/developer-actions";

const EVENTS = [
  { id: "contact.opted_in", label: "Contact opted in" },
  { id: "contact.tagged", label: "Contact tagged" },
  { id: "order.paid", label: "Order paid" },
  { id: "form.submitted", label: "Form submitted" },
  { id: "booking.created", label: "Booking created" },
  { id: "webinar.registered", label: "Webinar registration" },
  { id: "webinar.attended", label: "Webinar attended" },
] as const;

function Secret({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1.5 rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
      <p className="text-xs font-medium text-amber-900 dark:text-amber-200">{label}</p>
      <div className="flex gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">{value}</code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />} Copy
        </Button>
      </div>
    </div>
  );
}

type Key = { id: string; name: string; prefix: string; lastUsedAt: string | null; revoked: boolean; createdAt: string };
type Hook = {
  id: string;
  url: string;
  events: string[];
  secret: string;
  status: "active" | "disabled";
  deliveries: { id: string; event: string; status: string; code: number | null; at: string; error: string | null }[];
};

export function Developers({
  workspaceSlug,
  keys,
  hooks,
  apiBase,
}: {
  workspaceSlug: string;
  keys: Key[];
  hooks: Hook[];
  apiBase: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newKey, setNewKey] = useState<string | null>(null);
  const [keyName, setKeyName] = useState("");
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["contact.opted_in", "order.paid"]);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; message?: string; secret?: string }>,
    after?: (r: { secret?: string }) => void,
  ) =>
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) return void toast.error(r.error ?? "Something went wrong");
        if (r.message) toast.success(r.message);
        after?.(r);
        router.refresh();
      } catch (err) {
        toast.error((err as Error).message);
      }
    });

  return (
    <div className="grid gap-8">
      <section className="grid gap-4 rounded-xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <KeyRoundIcon className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-semibold">API keys</h2>
            <p className="text-sm text-muted-foreground">
              Use the REST API at <code className="rounded bg-muted px-1 text-xs">{apiBase}</code> with{" "}
              <code className="rounded bg-muted px-1 text-xs">Authorization: Bearer zf_…</code>. See docs/API.md.
            </p>
          </div>
        </div>
        {newKey && <Secret value={newKey} label="Copy your key now. For your security we won't show it again." />}
        <form
          className="flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createApiKey(workspaceSlug, keyName),
              (r) => {
                setNewKey(r.secret ?? null);
                setKeyName("");
              },
            );
          }}
        >
          <Input
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
            placeholder="Key name, e.g. Zapier"
            aria-label="Key name"
          />
          <Button type="submit" disabled={pending || !keyName.trim()}>
            Create key
          </Button>
        </form>
        {keys.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {keys.map((k) => (
              <li key={k.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${k.revoked ? "opacity-50" : ""}`}>
                <span className="font-medium">{k.name}</span>
                <code className="text-xs text-muted-foreground">{k.prefix}…</code>
                <span className="flex-1 text-xs text-muted-foreground">
                  {k.revoked
                    ? "Revoked"
                    : k.lastUsedAt
                      ? `Last used ${new Date(k.lastUsedAt).toLocaleString()}`
                      : "Never used"}
                </span>
                {!k.revoked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      confirm(`Revoke “${k.name}”? Apps using it stop working immediately.`) &&
                      run(() => revokeApiKey(workspaceSlug, k.id))
                    }
                  >
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 rounded-xl border bg-card p-6">
        <div className="flex items-start gap-3">
          <WebhookIcon className="mt-0.5 size-5 text-primary" />
          <div>
            <h2 className="font-semibold">Webhooks</h2>
            <p className="text-sm text-muted-foreground">
              We POST signed JSON to your URL when things happen. Works with Zapier, Make and n8n “Catch hook” triggers.
            </p>
          </div>
        </div>
        {newSecret && <Secret value={newSecret} label="Signing secret: verify the ZFunnel-Signature header with it." />}
        <form
          className="grid gap-3 rounded-lg border p-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => createWebhook(workspaceSlug, { url, events: events as never }),
              (r) => {
                setNewSecret(r.secret ?? null);
                setUrl("");
              },
            );
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="wh-url">Endpoint URL</Label>
            <Input
              id="wh-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/…"
            />
          </div>
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
            <legend className="mb-1 text-sm font-medium">Events</legend>
            {EVENTS.map((ev) => (
              <label key={ev.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={events.includes(ev.id)}
                  onChange={(e) => setEvents(e.target.checked ? [...events, ev.id] : events.filter((x) => x !== ev.id))}
                />
                {ev.label}
              </label>
            ))}
          </fieldset>
          <div>
            <Button type="submit" disabled={pending || !url}>
              {pending && <Loader2Icon className="animate-spin" />} Add webhook
            </Button>
          </div>
        </form>
        {hooks.map((h) => (
          <div key={h.id} className="rounded-lg border">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
              <span className={`size-2 rounded-full ${h.status === "active" ? "bg-emerald-500" : "bg-zinc-400"}`} />
              <code className="min-w-0 flex-1 truncate text-sm">{h.url}</code>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run(() => sendTestWebhook(workspaceSlug, h.id))}
              >
                <SendIcon /> Test
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => setWebhookStatus(workspaceSlug, h.id, h.status === "active" ? "disabled" : "active"))
                }
              >
                {h.status === "active" ? "Disable" : "Enable"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-destructive"
                aria-label="Delete webhook"
                onClick={() => confirm("Delete this webhook?") && run(() => deleteWebhook(workspaceSlug, h.id))}
              >
                <Trash2Icon />
              </Button>
            </div>
            <p className="px-4 pt-2 text-xs text-muted-foreground">{h.events.join(" · ")}</p>
            <ul className="grid gap-1 px-4 py-2 text-xs">
              {h.deliveries.length === 0 && <li className="text-muted-foreground">No deliveries yet.</li>}
              {h.deliveries.map((d) => (
                <li key={d.id} className="flex items-center gap-2">
                  <span
                    className={
                      d.status === "succeeded"
                        ? "text-emerald-600"
                        : d.status === "failed"
                          ? "text-destructive"
                          : "text-amber-600"
                    }
                  >
                    ●
                  </span>
                  <span className="font-medium">{d.event}</span>
                  <span className="text-muted-foreground">{d.code ? `HTTP ${d.code}` : d.status}</span>
                  {d.error && <span className="truncate text-muted-foreground">{d.error}</span>}
                  <span className="ml-auto text-muted-foreground">{new Date(d.at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
