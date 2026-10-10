"use client";

import { Badge } from "@zfunnel/ui/badge";
import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { NativeSelect } from "@zfunnel/ui/select";
import { toast } from "@zfunnel/ui/toaster";
import { Tooltip } from "@zfunnel/ui/tooltip";
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
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{value}</code>
      <Tooltip label="Copy">
        <button
          type="button"
          className="shrink-0 p-1 text-muted-foreground hover:text-foreground"
          aria-label={`Copy ${value}`}
          onClick={() => {
            void navigator.clipboard.writeText(value);
            toast.success("Copied");
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
  const router = useRouter();
  const [busy, start] = useTransition();
  const [input, setInput] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, success?: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) toast.success(r.message ?? success ?? "Done");
      else toast.error(r.error ?? "Something went wrong");
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
          }, "Domain added: now add the DNS records below");
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="offer.yourbrand.com"
          aria-label="Domain"
          className="sm:max-w-sm"
        />
        <Button type="submit" disabled={busy || !input}>
          {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} Add domain
        </Button>
      </form>

      {domains.map((d) => (
        <div key={d.id} className="rounded-xl border">
          <div className="flex flex-wrap items-center gap-3 border-b p-4">
            <GlobeIcon className="size-5 text-muted-foreground" />
            <a href={`https://${d.hostname}`} target="_blank" rel="noreferrer" className="font-medium hover:underline">
              {d.hostname}
            </a>
            {d.status === "active" ? (
              <Badge variant="success">Connected</Badge>
            ) : (
              <Badge variant="warning">Waiting for DNS</Badge>
            )}
            <div className="ms-auto flex items-center gap-2">
              <NativeSelect
                aria-label="Homepage for this domain"
                value={d.funnelId ?? ""}
                onChange={(e) =>
                  run(() => setDomainFunnel(workspaceSlug, d.id, e.target.value || null), "Homepage updated")
                }
                className="h-8 w-48 text-xs"
              >
                <option value="">Workspace homepage</option>
                {funnels.map((f) => (
                  <option key={f.id} value={f.id}>
                    Homepage: {f.name}
                  </option>
                ))}
              </NativeSelect>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(() => verifyDomain(workspaceSlug, d.id))}
              >
                <RefreshCwIcon /> {d.status === "active" ? "Re-check" : "Verify"}
              </Button>
              <Tooltip label="Remove domain">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${d.hostname}`}
                  onClick={() =>
                    confirm(`Remove ${d.hostname}? Pages on it stop working immediately.`) &&
                    run(() => removeDomain(workspaceSlug, d.id), "Domain removed")
                  }
                >
                  <Trash2Icon />
                </Button>
              </Tooltip>
            </div>
          </div>
          {d.status !== "active" && (
            <div className="space-y-3 p-4 text-sm">
              <p className="text-muted-foreground">
                Add these records at your domain provider (GoDaddy, Namecheap, Cloudflare…), then click Verify. Changes
                can take a few minutes.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-start">
                  <thead className="text-xs text-muted-foreground uppercase">
                    <tr>
                      <th className="py-1 pe-4">Type</th>
                      <th className="py-1 pe-4">Name</th>
                      <th className="py-1">Value</th>
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
                          Root domain (no www)? Use an <strong>A</strong> record to <Copyable value={ipv4} /> instead of
                          the CNAME.
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
              {d.lastError && <p className="text-amber-600 dark:text-amber-400">Last check: {d.lastError}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
