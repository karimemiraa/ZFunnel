"use client";

import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { toast } from "@zfunnel/ui/toaster";
import { useT } from "@zfunnel/i18n/react";
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
import { useFmt } from "@/lib/use-fmt";

const EVENTS = [
  { id: "contact.opted_in", label: "developers.events.contactOptedIn" },
  { id: "contact.tagged", label: "developers.events.contactTagged" },
  { id: "order.paid", label: "developers.events.orderPaid" },
  { id: "form.submitted", label: "developers.events.formSubmitted" },
  { id: "booking.created", label: "developers.events.bookingCreated" },
  { id: "webinar.registered", label: "developers.events.webinarRegistered" },
  { id: "webinar.attended", label: "developers.events.webinarAttended" },
] as const;

const DELIVERY_STATUS = ["pending", "succeeded", "failed"] as const;

function Secret({ value, label }: { value: string; label: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1.5 rounded-lg border border-amber-300/60 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
      <p className="text-xs font-medium text-amber-900 dark:text-amber-200">{label}</p>
      <div className="flex gap-2">
        <code dir="ltr" className="min-w-0 flex-1 truncate rounded bg-background px-2 py-1.5 text-start text-xs">
          {value}
        </code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void navigator.clipboard.writeText(value);
            setCopied(true);
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />} {t("common.copy")}
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
  const t = useT();
  const fmt = useFmt();
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
        if (!r.ok) return void toast.error(r.error ?? t("developers.somethingWrong"));
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
            <h2 className="font-semibold">{t("developers.apiKeys")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("developers.apiUseAt")}{" "}
              <code dir="ltr" className="rounded bg-muted px-1 text-xs">
                {apiBase}
              </code>{" "}
              {t("developers.apiWith")}{" "}
              <code dir="ltr" className="rounded bg-muted px-1 text-xs">
                Authorization: Bearer zf_…
              </code>
              {t("developers.apiSeeDocs")}
            </p>
          </div>
        </div>
        {newKey && <Secret value={newKey} label={t("developers.copyKeyNow")} />}
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
            placeholder={t("developers.keyPlaceholder")}
            aria-label={t("developers.keyName")}
          />
          <Button type="submit" disabled={pending || !keyName.trim()}>
            {t("developers.createKey")}
          </Button>
        </form>
        {keys.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {keys.map((k) => (
              <li key={k.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${k.revoked ? "opacity-50" : ""}`}>
                <span className="font-medium">{k.name}</span>
                <code dir="ltr" className="text-xs text-muted-foreground">
                  {k.prefix}…
                </code>
                <span className="flex-1 text-xs text-muted-foreground">
                  {k.revoked
                    ? t("developers.revoked")
                    : k.lastUsedAt
                      ? t("developers.lastUsed", { date: fmt.dateTime(k.lastUsedAt) })
                      : t("developers.neverUsed")}
                </span>
                {!k.revoked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      confirm(t("developers.revokeConfirm", { name: k.name })) &&
                      run(() => revokeApiKey(workspaceSlug, k.id))
                    }
                  >
                    {t("developers.revoke")}
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
            <h2 className="font-semibold">{t("developers.webhooks")}</h2>
            <p className="text-sm text-muted-foreground">{t("developers.webhooksIntro")}</p>
          </div>
        </div>
        {newSecret && <Secret value={newSecret} label={t("developers.signingSecret")} />}
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
            <Label htmlFor="wh-url">{t("developers.endpointUrl")}</Label>
            <Input
              id="wh-url"
              type="url"
              dir="ltr"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://hooks.zapier.com/…"
            />
          </div>
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
            <legend className="mb-1 text-sm font-medium">{t("developers.eventsLabel")}</legend>
            {EVENTS.map((ev) => (
              <label key={ev.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={events.includes(ev.id)}
                  onChange={(e) => setEvents(e.target.checked ? [...events, ev.id] : events.filter((x) => x !== ev.id))}
                />
                {t(ev.label)}
              </label>
            ))}
          </fieldset>
          <div>
            <Button type="submit" disabled={pending || !url}>
              {pending && <Loader2Icon className="animate-spin" />} {t("developers.addWebhook")}
            </Button>
          </div>
        </form>
        {hooks.map((h) => (
          <div key={h.id} className="rounded-lg border">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
              <span className={`size-2 rounded-full ${h.status === "active" ? "bg-emerald-500" : "bg-zinc-400"}`} />
              <code dir="ltr" className="min-w-0 flex-1 truncate text-start text-sm">
                {h.url}
              </code>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run(() => sendTestWebhook(workspaceSlug, h.id))}
              >
                <SendIcon /> {t("developers.test")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => setWebhookStatus(workspaceSlug, h.id, h.status === "active" ? "disabled" : "active"))
                }
              >
                {h.status === "active" ? t("developers.disable") : t("developers.enable")}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 hover:text-destructive"
                aria-label={t("developers.deleteWebhook")}
                onClick={() => confirm(t("developers.deleteConfirm")) && run(() => deleteWebhook(workspaceSlug, h.id))}
              >
                <Trash2Icon />
              </Button>
            </div>
            <p dir="ltr" className="px-4 pt-2 text-start text-xs text-muted-foreground">
              {h.events.join(" · ")}
            </p>
            <ul className="grid gap-1 px-4 py-2 text-xs">
              {h.deliveries.length === 0 && <li className="text-muted-foreground">{t("developers.noDeliveries")}</li>}
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
                  <span className="text-muted-foreground">
                    {d.code
                      ? `HTTP ${d.code}`
                      : (DELIVERY_STATUS as readonly string[]).includes(d.status)
                        ? t(`developers.deliveryStatus.${d.status as (typeof DELIVERY_STATUS)[number]}`)
                        : d.status}
                  </span>
                  {d.error && <span className="truncate text-muted-foreground">{d.error}</span>}
                  <span className="ms-auto text-muted-foreground">{fmt.dateTime(d.at)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
