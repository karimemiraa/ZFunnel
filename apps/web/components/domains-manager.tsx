"use client";

import { Badge } from "@zfunnel/ui/badge";
import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { NativeSelect } from "@zfunnel/ui/select";
import { toast } from "@zfunnel/ui/toaster";
import { Tooltip } from "@zfunnel/ui/tooltip";
import { useT } from "@zfunnel/i18n/react";
import { CopyIcon, GlobeIcon, Loader2Icon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addDomain, removeDomain, setDomainFunnel, verifyDomain } from "@/lib/domain-actions";

type Domain = {
  id: string;
  hostname: string;
  status: "pending" | "active" | "failed";
  verificationToken: string;
  funnelId: string | null;
  lastError: string | null;
};

function Copyable({ value }: { value: string }) {
  const t = useT();
  return (
    <span dir="ltr" className="inline-flex max-w-full items-center gap-1">
      <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{value}</code>
      <Tooltip label={t("common.copy")}>
        <button
          type="button"
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
          aria-label={t("domains.copyValue", { value })}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success(t("common.copied"));
          }}
        >
          <CopyIcon className="size-3.5" />
        </button>
      </Tooltip>
    </span>
  );
}

export function DomainsManager({
  workspaceSlug,
  domains,
  funnels,
  cnameTarget,
  ipv4,
}: {
  workspaceSlug: string;
  domains: Domain[];
  funnels: { id: string; name: string }[];
  cnameTarget: string;
  ipv4: string;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  const [input, setInput] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, success?: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? success ?? t("domains.done"));
      else toast.error(r.error ?? t("domains.somethingWrong"));
      router.refresh();
    });

  return (
    <div className="space-y-6">
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const r = await addDomain(workspaceSlug, input);
            if (r.ok) setInput("");
            return r;
          }, t("domains.added"));
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="offer.yourbrand.com"
          aria-label={t("domains.domain")}
          dir="ltr"
          className="sm:max-w-sm"
        />
        <Button type="submit" disabled={busy || !input}>
          {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} {t("domains.addDomain")}
        </Button>
      </form>

      {domains.map((d) => (
        <div key={d.id} className="rounded-xl border">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <GlobeIcon className="size-5 text-muted-foreground" />
            <a
              href={`https://${d.hostname}`}
              target="_blank"
              rel="noreferrer"
              dir="ltr"
              className="font-medium hover:underline"
            >
              {d.hostname}
            </a>
            {d.status === "active" ? (
              <Badge variant="success">{t("domains.connected")}</Badge>
            ) : (
              <Badge variant="warning">{t("domains.waitingDns")}</Badge>
            )}
            <div className="ms-auto flex items-center gap-2">
              <NativeSelect
                aria-label={t("domains.homepageLabel")}
                value={d.funnelId ?? ""}
                onChange={(e) =>
                  run(() => setDomainFunnel(workspaceSlug, d.id, e.target.value || null), t("domains.homepageUpdated"))
                }
                className="h-8 w-48 text-xs"
              >
                <option value="">{t("domains.workspaceHomepage")}</option>
                {funnels.map((f) => (
                  <option key={f.id} value={f.id}>
                    {t("domains.homepageFunnel", { name: f.name })}
                  </option>
                ))}
              </NativeSelect>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(() => verifyDomain(workspaceSlug, d.id))}
              >
                <RefreshCwIcon /> {d.status === "active" ? t("domains.recheck") : t("domains.verify")}
              </Button>
              <Tooltip label={t("domains.remove")}>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("domains.removeAria", { hostname: d.hostname })}
                  onClick={() =>
                    confirm(t("domains.removeConfirm", { hostname: d.hostname })) &&
                    run(() => removeDomain(workspaceSlug, d.id), t("domains.removed"))
                  }
                >
                  <Trash2Icon />
                </Button>
              </Tooltip>
            </div>
          </div>
          {d.status !== "active" && (
            <div className="space-y-3 p-4 text-sm">
              <p className="text-muted-foreground">{t("domains.instructions")}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-start">
                  <thead className="text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="py-1 pe-4">{t("domains.type")}</th>
                      <th className="py-1 pe-4">{t("domains.name")}</th>
                      <th className="py-1">{t("domains.value")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="py-1.5 pe-4 font-medium">CNAME</td>
                      <td className="py-1.5 pe-4">
                        <Copyable value={d.hostname} />
                      </td>
                      <td className="py-1.5">
                        <Copyable value={cnameTarget} />
                      </td>
                    </tr>
                    {ipv4 && (
                      <tr>
                        <td className="py-1.5 pe-4 text-xs text-muted-foreground" colSpan={3}>
                          {t("domains.rootBefore")} <strong>A</strong> {t("domains.rootMiddle")}{" "}
                          <Copyable value={ipv4} /> {t("domains.rootAfter")}
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-1.5 pe-4 font-medium">TXT</td>
                      <td className="py-1.5 pe-4">
                        <Copyable value={`_zfunnel.${d.hostname}`} />
                      </td>
                      <td className="py-1.5">
                        <Copyable value={d.verificationToken} />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {d.lastError && (
                <p className="text-amber-600 dark:text-amber-400">{t("domains.lastCheck", { error: d.lastError })}</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
