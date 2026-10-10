"use client";

import { formatMoney } from "@zfunnel/payments/money";
import { Badge } from "@zfunnel/ui/badge";
import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon, TagIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setTags } from "@/lib/crm-actions";

type Row = {
  id: string;
  email: string;
  name: string | null;
  tags: string[];
  orderCount: number;
  spent: number;
  funnelName: string | null;
  utm: string | null;
  added: string;
};

export function ContactsTable({ workspaceSlug, rows }: { workspaceSlug: string; rows: Row[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [tag, setTag] = useState("");
  const [busy, start] = useTransition();
  const all = rows.length > 0 && selected.size === rows.length;
  const toggle = (id: string) =>
    setSelected((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set([...s, id])));
  const bulk = (mode: "add" | "remove") =>
    start(async () => {
      const r = await setTags(workspaceSlug, [...selected], tag, mode);
      if (r.ok) {
        toast.success(r.message ?? "Done");
        setTag("");
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Input
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="tag name"
            className="h-8 w-40"
            aria-label="Tag"
          />
          <Button size="sm" disabled={busy || !tag} onClick={() => bulk("add")}>
            {busy ? <Loader2Icon className="animate-spin" /> : <TagIcon />} Add tag
          </Button>
          <Button size="sm" variant="outline" disabled={busy || !tag} onClick={() => bulk("remove")}>
            Remove tag
          </Button>
          <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setSelected(new Set())}>
            <XIcon /> Clear
          </Button>
        </div>
      )}
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <tr>
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={all}
                onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
                aria-label="Select all"
              />
            </th>
            <th className="px-2 py-3">Contact</th>
            <th className="px-4 py-3 max-lg:hidden">Tags</th>
            <th className="px-4 py-3 max-md:hidden">Source</th>
            <th className="px-4 py-3 max-sm:hidden">Status</th>
            <th className="px-4 py-3 text-end">Spent</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((c) => (
            <tr key={c.id} className="group hover:bg-muted/30">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  aria-label={`Select ${c.email}`}
                />
              </td>
              <td className="px-2 py-3">
                <Link href={`/${workspaceSlug}/contacts/${c.id}`} className="flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {(c.name ?? c.email).slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium group-hover:underline">{c.name ?? "—"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{c.email}</span>
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3 max-lg:hidden">
                <div className="flex flex-wrap gap-1">
                  {c.tags.slice(0, 4).map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                  {c.tags.length > 4 && <Badge variant="outline">+{c.tags.length - 4}</Badge>}
                </div>
              </td>
              <td className="px-4 py-3 max-md:hidden">
                <div className="max-w-[12rem] truncate">{c.funnelName ?? "—"}</div>
                {c.utm && <div className="text-xs text-muted-foreground">via {c.utm}</div>}
              </td>
              <td className="px-4 py-3 max-sm:hidden">
                {c.orderCount > 0 ? (
                  <Badge variant="success">Customer · {c.orderCount}</Badge>
                ) : (
                  <Badge variant="secondary">Lead</Badge>
                )}
              </td>
              <td className="px-4 py-3 text-end font-medium tabular-nums">
                {c.spent ? formatMoney(c.spent, "usd") : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
