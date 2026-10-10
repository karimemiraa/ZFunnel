"use client";

import { Button } from "@zfunnel/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@zfunnel/ui/dialog";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { NativeSelect } from "@zfunnel/ui/select";
import { toast } from "@zfunnel/ui/toaster";
import { useT } from "@zfunnel/i18n/react";
import { FilterIcon, Loader2Icon, PlusIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveSegment } from "@/lib/crm-actions";

type Rule = { field: string; op: string; value?: string | number; key?: string };
const FIELDS = [
  {
    value: "tag",
    label: "tag",
    ops: [
      ["has", "has"],
      ["not_has", "notHas"],
    ],
    input: "text",
  },
  { value: "email", label: "email", ops: [["contains", "contains"]], input: "text" },
  { value: "name", label: "name", ops: [["contains", "contains"]], input: "text" },
  {
    value: "created",
    label: "added",
    ops: [
      ["within_days", "withinDays"],
      ["older_than_days", "olderThanDays"],
    ],
    input: "number",
  },
  {
    value: "customer",
    label: "customer",
    ops: [
      ["is", "hasBought"],
      ["is_not", "hasNotBought"],
    ],
    input: "none",
  },
  { value: "source_funnel", label: "sourceFunnel", ops: [["is", "is"]], input: "funnel" },
  {
    value: "custom",
    label: "customField",
    ops: [
      ["equals", "equals"],
      ["contains", "contains"],
      ["is_set", "isSet"],
    ],
    input: "custom",
  },
] as const;

export function SegmentBuilder({
  workspaceSlug,
  funnels,
  fields,
  tags,
}: {
  workspaceSlug: string;
  funnels: { id: string; name: string }[];
  fields: { key: string; label: string }[];
  tags: string[];
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [match, setMatch] = useState<"all" | "any">("all");
  const [rules, setRules] = useState<Rule[]>([{ field: "tag", op: "has", value: tags[0] ?? "" }]);
  const [busy, start] = useTransition();
  const update = (i: number, patch: Partial<Rule>) =>
    setRules((r) => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FilterIcon /> {t("contacts.segment.new")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("contacts.segment.new")}</DialogTitle>
          <DialogDescription>{t("contacts.segment.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="seg-name">{t("contacts.name")}</Label>
              <Input
                id="seg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("contacts.segment.namePlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="seg-match">{t("contacts.segment.match")}</Label>
              <NativeSelect id="seg-match" value={match} onChange={(e) => setMatch(e.target.value as "all" | "any")}>
                <option value="all">{t("contacts.segment.allRules")}</option>
                <option value="any">{t("contacts.segment.anyRule")}</option>
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-2">
            {rules.map((r, i) => {
              const def = FIELDS.find((f) => f.value === r.field)!;
              return (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
                  <NativeSelect
                    aria-label={t("contacts.segment.field")}
                    value={r.field}
                    onChange={(e) => {
                      const d = FIELDS.find((f) => f.value === e.target.value)!;
                      update(i, {
                        field: d.value,
                        op: d.ops[0][0],
                        value: d.input === "number" ? 30 : d.input === "funnel" ? funnels[0]?.id : "",
                        key: d.input === "custom" ? fields[0]?.key : undefined,
                      });
                    }}
                    className="w-36"
                  >
                    {FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {t(`contacts.segment.fields.${f.label}`)}
                      </option>
                    ))}
                  </NativeSelect>
                  {def.input === "custom" && (
                    <NativeSelect
                      aria-label={t("contacts.segment.fields.customField")}
                      value={r.key ?? ""}
                      onChange={(e) => update(i, { key: e.target.value })}
                      className="w-36"
                    >
                      {fields.map((f) => (
                        <option key={f.key} value={f.key}>
                          {f.label}
                        </option>
                      ))}
                    </NativeSelect>
                  )}
                  <NativeSelect
                    aria-label={t("contacts.segment.condition")}
                    value={r.op}
                    onChange={(e) => update(i, { op: e.target.value })}
                    className="w-44"
                  >
                    {def.ops.map(([v, l]) => (
                      <option key={v} value={v}>
                        {t(`contacts.segment.ops.${l}`)}
                      </option>
                    ))}
                  </NativeSelect>
                  {def.input === "text" || (def.input === "custom" && r.op !== "is_set") ? (
                    <Input
                      aria-label={t("contacts.segment.value")}
                      value={String(r.value ?? "")}
                      onChange={(e) => update(i, { value: e.target.value })}
                      className="h-9 w-40 flex-1"
                      list={r.field === "tag" ? "seg-tags" : undefined}
                    />
                  ) : def.input === "number" ? (
                    <Input
                      aria-label={t("contacts.segment.days")}
                      type="number"
                      min={1}
                      value={Number(r.value ?? 30)}
                      onChange={(e) => update(i, { value: Number(e.target.value) })}
                      className="h-9 w-24"
                    />
                  ) : def.input === "funnel" ? (
                    <NativeSelect
                      aria-label={t("contacts.segment.funnel")}
                      value={String(r.value ?? "")}
                      onChange={(e) => update(i, { value: e.target.value })}
                      className="w-48"
                    >
                      {funnels.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </NativeSelect>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("contacts.segment.removeRule")}
                    disabled={rules.length === 1}
                    onClick={() => setRules((x) => x.filter((_, j) => j !== i))}
                    className="ms-auto"
                  >
                    <XIcon />
                  </Button>
                </div>
              );
            })}
            <datalist id="seg-tags">
              {tags.map((tag) => (
                <option key={tag} value={tag} />
              ))}
            </datalist>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRules((r) => [...r, { field: "tag", op: "has", value: "" }])}
            >
              <PlusIcon /> {t("contacts.segment.addRule")}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button
              disabled={busy}
              onClick={() =>
                start(async () => {
                  const res = await saveSegment(workspaceSlug, { name, match, rules });
                  if (!res.ok) return void toast.error(res.error);
                  toast.success(t("contacts.segment.saved"));
                  setOpen(false);
                  router.push(`/${workspaceSlug}/contacts?segment=${res.id}`);
                })
              }
            >
              {busy && <Loader2Icon className="animate-spin" />} {t("contacts.segment.save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
