"use client";

import { useT } from "@zfunnel/i18n/react";
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
import { LinkIcon, Loader2Icon, TriangleAlertIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import type { UsedInItem, UsedInKind } from "@/lib/records";
import { getUsedIn, type TrashKind } from "@/lib/records-actions";
import { useTrash } from "./use-trash";

/** One "Used in" line, e.g. "Order bump on Webinar funnel › Checkout". */
export function UsedInLine({ item }: { item: UsedInItem }) {
  const t = useT();
  const text = t(`records.usedIn.${item.type}`, {
    count: item.count ?? 0,
    name: item.name ?? "",
    role: item.role ? t(`records.roles.${item.role}`) : "",
  });
  return item.href ? (
    <Link href={item.href} className="inline-flex items-center gap-1.5 hover:underline">
      <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
      {text}
    </Link>
  ) : (
    <span>{text}</span>
  );
}

/** The "Used in" panel: what depends on a record. Loads when shown. */
export function UsedInPanel({ workspaceSlug, kind, id }: { workspaceSlug: string; kind: UsedInKind; id: string }) {
  const t = useT();
  const [items, setItems] = useState<UsedInItem[] | null>(null);
  useEffect(() => {
    let live = true;
    getUsedIn(workspaceSlug, kind, id)
      .then((r) => live && setItems(r))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, [workspaceSlug, kind, id]);
  if (!items)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> {t("records.usedIn.checking")}
      </p>
    );
  if (!items.length) return <p className="text-sm text-muted-foreground">{t("records.usedIn.none")}</p>;
  return (
    <div
      className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
      data-testid="used-in"
    >
      <p className="mb-2 flex items-center gap-2 font-medium">
        <TriangleAlertIcon className="size-4 shrink-0" /> {t("records.usedIn.title")}
      </p>
      <ul className="space-y-1.5 ps-6">
        {items.map((it, i) => (
          <li key={i}>
            <UsedInLine item={it} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Delete with a "Used in" warning. Shows what depends on the record, still allows the delete,
 * then soft-deletes it with a 10-second undo toast. `onConfirm` replaces the soft delete for
 * records that are deleted for good (emails).
 */
export function DeleteDialog({
  workspaceSlug,
  kind,
  usedInKind,
  id,
  name,
  trigger,
  after,
  onConfirm,
  undoable = true,
  open: openProp,
  onOpenChange,
}: {
  workspaceSlug: string;
  kind?: TrashKind;
  usedInKind: UsedInKind;
  id: string;
  name: string;
  /** Omit when the dialog is opened from elsewhere (a menu item) via `open`/`onOpenChange`. */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Runs after the delete (e.g. navigate back to the list). */
  after?: () => void;
  onConfirm?: () => Promise<void> | void;
  undoable?: boolean;
}) {
  const t = useT();
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (o: boolean) => (onOpenChange ? onOpenChange(o) : setOpenState(o));
  const [busy, start] = useTransition();
  const trash = useTrash(workspaceSlug);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("records.delete.title", { name })}</DialogTitle>
          <DialogDescription>
            {undoable ? t("records.delete.undoHint") : t("records.delete.permanentHint")}
          </DialogDescription>
        </DialogHeader>
        {open && <UsedInPanel workspaceSlug={workspaceSlug} kind={usedInKind} id={id} />}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={busy}
            data-testid="confirm-delete"
            onClick={() =>
              start(async () => {
                if (onConfirm) await onConfirm();
                else if (kind && !(await trash(kind, [id], { after }))) return;
                setOpen(false);
              })
            }
          >
            {busy ? <Loader2Icon className="animate-spin" /> : undoable ? <Undo2Icon /> : <Trash2Icon />}
            {t("records.delete.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
