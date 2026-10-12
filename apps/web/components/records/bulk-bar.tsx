"use client";

import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@zfunnel/ui/dialog";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { toast } from "@zfunnel/ui/toaster";
import { DownloadIcon, Loader2Icon, TagIcon, TagsIcon, Trash2Icon, WorkflowIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { filtersToQuery, type ListFilters } from "@/lib/list-filters";
import { bulkAction, type Selection } from "@/lib/records-actions";
import { useTrash, useUndoToast } from "./use-trash";

/** Row selection for a list page: some rows, the whole page, or every row matching the filters. */
export function useSelection(pageIds: string[]) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const pageSelected = pageIds.length > 0 && pageIds.every((id) => picked.has(id));
  const toggle = useCallback((id: string) => {
    setAllMatching(false);
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const togglePage = useCallback(() => {
    setAllMatching(false);
    setPicked((s) => (pageIds.every((id) => s.has(id)) ? new Set() : new Set(pageIds)));
  }, [pageIds]);
  const clear = useCallback(() => {
    setPicked(new Set());
    setAllMatching(false);
  }, []);
  return {
    picked,
    allMatching,
    pageSelected,
    toggle,
    togglePage,
    clear,
    selectAllMatching: () => {
      setPicked(new Set(pageIds));
      setAllMatching(true);
    },
  };
}
export type SelectionState = ReturnType<typeof useSelection>;

type Mode = "tag" | "untag" | "enroll" | "delete" | null;

/**
 * Bulk actions bar (Phase 8.5c). Every action asks for confirmation first. Deletes are soft and
 * come with the 10-second undo toast.
 */
export function BulkBar({
  workspaceSlug,
  resource,
  selection,
  pageIds,
  total,
  filters,
  segmentId,
  workflows = [],
  exportPath,
}: {
  workspaceSlug: string;
  resource: "contacts" | "orders" | "funnels";
  selection: SelectionState;
  pageIds: string[];
  total: number;
  filters?: ListFilters;
  segmentId?: string | null;
  workflows?: { id: string; name: string }[];
  /** CSV export route; gets `ids=` or the filters. */
  exportPath: string;
}) {
  const t = useT();
  const router = useRouter();
  const trash = useTrash(workspaceSlug);
  const undoToast = useUndoToast(workspaceSlug);
  const [mode, setMode] = useState<Mode>(null);
  const [tag, setTag] = useState("");
  const [workflowId, setWorkflowId] = useState(workflows[0]?.id ?? "");
  const [busy, start] = useTransition();
  const { picked, allMatching } = selection;
  const count = allMatching ? total : picked.size;
  const ids = useMemo(() => [...picked], [picked]);
  const sel: Selection = allMatching
    ? { mode: "all", filters: filters ?? {}, segmentId: segmentId ?? null }
    : { mode: "ids", ids };
  const exportHref = useMemo(() => {
    const qs = allMatching
      ? [filtersToQuery(filters ?? {}), segmentId ? `segment=${segmentId}` : ""].filter(Boolean).join("&")
      : `ids=${ids.join(",")}`;
    return `${exportPath}${qs ? `?${qs}` : ""}`;
  }, [allMatching, exportPath, filters, ids, segmentId]);

  if (!picked.size && !allMatching) return null;
  const people = resource === "orders" ? "records.bulk.buyersOf" : "records.bulk.contactsCount";

  const run = () =>
    start(async () => {
      if (mode === "delete") {
        const ok =
          resource === "funnels"
            ? await trash("funnel", ids)
            : await (async () => {
                const r = await bulkAction(workspaceSlug, "contacts", sel, { type: "delete" });
                if (!r.ok) return (toast.error(r.error), false);
                if ("undo" in r && r.undo) undoToast(r.message ?? "", r.undo);
                return true;
              })();
        if (ok) selection.clear();
        setMode(null);
        router.refresh();
        return;
      }
      if (resource === "funnels" || !mode) return;
      const action = mode === "enroll" ? ({ type: "enroll", workflowId } as const) : ({ type: mode, tag } as const);
      const r = await bulkAction(workspaceSlug, resource, sel, action);
      if (r.ok) {
        toast.success(r.message ?? t("records.done"));
        selection.clear();
        setMode(null);
        setTag("");
        router.refresh();
      } else toast.error(r.error);
    });

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-2 border-b bg-brand-orange/10 px-4 py-2.5 text-sm"
        role="region"
        aria-label={t("records.bulk.region")}
      >
        <span className="font-medium" data-testid="bulk-count">
          {t("records.bulk.selected", { count })}
        </span>
        {selection.pageSelected && !allMatching && total > pageIds.length && (
          <button
            type="button"
            className="font-medium text-primary hover:underline"
            onClick={selection.selectAllMatching}
          >
            {t("records.bulk.selectAllMatching", { count: total })}
          </button>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          {resource !== "funnels" && (
            <>
              <Button size="sm" variant="outline" onClick={() => setMode("tag")}>
                <TagIcon /> {t("records.bulk.tag")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode("untag")}>
                <TagsIcon /> {t("records.bulk.untag")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setMode("enroll")} disabled={!workflows.length}>
                <WorkflowIcon /> {t("records.bulk.enroll")}
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" asChild>
            <a href={exportHref} download>
              <DownloadIcon /> {t("records.bulk.export")}
            </a>
          </Button>
          {resource !== "orders" && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setMode("delete")}>
              <Trash2Icon /> {t("common.delete")}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={selection.clear} aria-label={t("records.bulk.clear")}>
            <XIcon /> {t("records.bulk.clear")}
          </Button>
        </div>
      </div>
      <Dialog open={mode !== null} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode ? t(`records.bulk.confirm.${mode}Title`, { count }) : ""}</DialogTitle>
            <DialogDescription>
              {mode === "delete"
                ? t(
                    resource === "funnels"
                      ? "records.bulk.confirm.deleteFunnels"
                      : "records.bulk.confirm.deleteContacts",
                    {
                      count,
                    },
                  )
                : t(people, { count })}
            </DialogDescription>
          </DialogHeader>
          {(mode === "tag" || mode === "untag") && (
            <div className="space-y-2">
              <Label htmlFor="bulk-tag">{t("records.bulk.tagLabel")}</Label>
              <Input
                id="bulk-tag"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder={t("records.bulk.tagPlaceholder")}
                autoFocus
              />
            </div>
          )}
          {mode === "enroll" && (
            <div className="space-y-2">
              <Label htmlFor="bulk-wf">{t("records.bulk.automationLabel")}</Label>
              <select
                id="bulk-wf"
                value={workflowId}
                onChange={(e) => setWorkflowId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {workflows.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant={mode === "delete" ? "destructive" : "default"}
              disabled={
                busy || ((mode === "tag" || mode === "untag") && !tag.trim()) || (mode === "enroll" && !workflowId)
              }
              onClick={run}
              data-testid="bulk-confirm"
            >
              {busy && <Loader2Icon className="animate-spin" />}
              {t("records.bulk.confirm.go")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Header/row checkbox with the same look everywhere. */
export function RowCheck({
  checked,
  onChange,
  label,
  indeterminate,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  indeterminate?: boolean;
}) {
  return (
    <input
      type="checkbox"
      className="size-4 accent-primary"
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate && !checked;
      }}
      onChange={onChange}
      aria-label={label}
    />
  );
}
