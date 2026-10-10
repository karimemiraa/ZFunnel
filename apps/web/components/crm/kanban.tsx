"use client";

import { Button } from "@zfunnel/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@zfunnel/ui/dialog";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { cn } from "@zfunnel/ui/lib/utils";
import { toast } from "@zfunnel/ui/toaster";
import { useT } from "@zfunnel/i18n/react";
import { Loader2Icon, PlusIcon, Trash2Icon, TrophyIcon, XCircleIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { addStage, createDeal, deleteDeal, moveDeal } from "@/lib/crm-actions";
import { useFmt } from "@/lib/use-fmt";

type Stage = { id: string; name: string; color: string; kind: "open" | "won" | "lost" };
type Deal = {
  id: string;
  stageId: string;
  title: string;
  value: number;
  currency: string;
  contactId: string | null;
  contactLabel: string | null;
};

function NewDealDialog({
  workspaceSlug,
  pipelineId,
  stage,
}: {
  workspaceSlug: string;
  pipelineId: string;
  stage: Stage;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground">
          <PlusIcon /> {t("pipelines.addDeal")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("pipelines.newDealIn", { stage: stage.name })}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => {
              const r = await createDeal(workspaceSlug, {
                pipelineId,
                stageId: stage.id,
                title: String(f.get("title")),
                value: Math.round(Number(String(f.get("value") || "0").replace(",", ".")) * 100) || 0,
                contactEmail: String(f.get("email") ?? ""),
              });
              if (!r.ok) return void toast.error(r.error);
              toast.success(t("pipelines.dealAdded"));
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="d-title">{t("pipelines.dealTitle")}</Label>
            <Input id="d-title" name="title" placeholder={t("pipelines.titlePlaceholder")} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="d-value">{t("pipelines.value")}</Label>
              <Input id="d-value" name="value" inputMode="decimal" placeholder="2500" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="d-email">{t("pipelines.contactEmail")}</Label>
              <Input id="d-email" name="email" type="email" dir="ltr" placeholder={t("common.optional")} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" />} {t("pipelines.addDeal")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Kanban({
  workspaceSlug,
  pipelineId,
  stages,
  deals,
}: {
  workspaceSlug: string;
  pipelineId: string;
  stages: Stage[];
  deals: Deal[];
}) {
  const t = useT();
  const f = useFmt();
  const router = useRouter();
  const [optimistic, applyMove] = useOptimistic(
    deals,
    (state, m: { id: string; stageId: string; beforeId: string | null }) => {
      const moving = state.find((d) => d.id === m.id);
      if (!moving) return state;
      const rest = state.filter((d) => d.id !== m.id);
      const idx = m.beforeId ? rest.findIndex((d) => d.id === m.beforeId) : -1;
      const moved = { ...moving, stageId: m.stageId };
      if (idx < 0) return [...rest, moved];
      return [...rest.slice(0, idx), moved, ...rest.slice(idx)];
    },
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [, start] = useTransition();
  const [newStage, setNewStage] = useState("");

  const drop = (stageId: string, beforeId: string | null) => {
    const id = dragId;
    setDragId(null);
    setOverStage(null);
    if (!id || id === beforeId) return;
    start(async () => {
      applyMove({ id, stageId, beforeId });
      const r = await moveDeal(workspaceSlug, id, stageId, beforeId);
      if (!r.ok) toast.error(r.error);
      router.refresh();
    });
  };

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-4 lg:-mx-8 lg:px-8">
      <div className="flex min-h-[60dvh] gap-4">
        {stages.map((s) => {
          const items = optimistic.filter((d) => d.stageId === s.id);
          const total = items.reduce((sum, d) => sum + d.value, 0);
          return (
            <section
              key={s.id}
              aria-label={s.name}
              onDragOver={(e) => {
                e.preventDefault();
                setOverStage(s.id);
              }}
              onDragLeave={() => setOverStage((x) => (x === s.id ? null : x))}
              onDrop={(e) => {
                e.preventDefault();
                drop(s.id, null);
              }}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors",
                overStage === s.id && "border-primary bg-primary/5",
              )}
            >
              <header className="flex items-center gap-2 px-3 py-3">
                <span className="size-2.5 rounded-full" style={{ background: s.color }} />
                <h2 className="flex-1 truncate text-sm font-semibold">{s.name}</h2>
                {s.kind === "won" && <TrophyIcon className="size-4 text-emerald-500" />}
                {s.kind === "lost" && <XCircleIcon className="size-4 text-muted-foreground" />}
                <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
              </header>
              <div className="px-3 pb-2 text-xs font-medium text-muted-foreground tabular-nums">
                {f.money(total, items[0]?.currency ?? "usd")}
              </div>
              <ol className="flex flex-1 flex-col gap-2 px-2 pb-2">
                {items.map((d) => (
                  <li
                    key={d.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(d.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      drop(s.id, d.id);
                    }}
                    className={cn(
                      "group cursor-grab rounded-lg border bg-card p-3 shadow-xs transition-all hover:shadow-md active:cursor-grabbing",
                      dragId === d.id && "opacity-40",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="flex-1 text-sm font-medium">{d.title}</span>
                      <button
                        type="button"
                        className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                        aria-label={t("pipelines.deleteDealAria", { title: d.title })}
                        onClick={() =>
                          confirm(t("pipelines.deleteDealConfirm", { title: d.title })) &&
                          start(async () => {
                            await deleteDeal(workspaceSlug, d.id);
                            router.refresh();
                          })
                        }
                      >
                        <Trash2Icon className="size-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      {d.contactId ? (
                        <Link
                          href={`/${workspaceSlug}/contacts/${d.contactId}`}
                          className="max-w-[60%] truncate text-muted-foreground hover:underline"
                        >
                          {d.contactLabel}
                        </Link>
                      ) : (
                        <span />
                      )}
                      <span className="font-semibold tabular-nums">{f.money(d.value, d.currency)}</span>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="px-2 pb-2">
                <NewDealDialog workspaceSlug={workspaceSlug} pipelineId={pipelineId} stage={s} />
              </div>
            </section>
          );
        })}
        <form
          className="w-60 shrink-0 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await addStage(workspaceSlug, pipelineId, newStage);
              if (!r.ok) return void toast.error(r.error);
              setNewStage("");
              router.refresh();
            });
          }}
        >
          <Input
            value={newStage}
            onChange={(e) => setNewStage(e.target.value)}
            placeholder={t("pipelines.newStageName")}
            aria-label={t("pipelines.newStageName")}
          />
          <Button type="submit" variant="outline" size="sm" className="w-full" disabled={!newStage}>
            <PlusIcon /> {t("pipelines.addStage")}
          </Button>
        </form>
      </div>
    </div>
  );
}
