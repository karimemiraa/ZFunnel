"use client";

import { useT } from "@zfunnel/i18n/react";
import { toast } from "@zfunnel/ui/toaster";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { restore, trash, type TrashKind, type UndoToken } from "@/lib/records-actions";

/** How long the undo button stays on screen (ADR-026). */
export const UNDO_MS = 10_000;

/** Shows the "Deleted · Undo" toast for a soft delete that already happened. */
export function useUndoToast(workspaceSlug: string) {
  const t = useT();
  const router = useRouter();
  return useCallback(
    (message: string, undo: UndoToken, onRestored?: () => void) => {
      toast.success(message, {
        duration: UNDO_MS,
        action: {
          label: t("records.undo"),
          onClick: async () => {
            const r = await restore(workspaceSlug, undo);
            if (r.ok) {
              toast.success(r.message ?? t("records.restored"));
              onRestored?.();
              router.refresh();
            } else toast.error(r.error);
          },
        },
      });
    },
    [router, t, workspaceSlug],
  );
}

/** Soft-deletes records and offers undo for 10 seconds. Resolves true when something was deleted. */
export function useTrash(workspaceSlug: string) {
  const router = useRouter();
  const undoToast = useUndoToast(workspaceSlug);
  return useCallback(
    async (kind: TrashKind, ids: string[], opts: { after?: () => void; onRestored?: () => void } = {}) => {
      const r = await trash(workspaceSlug, kind, ids);
      if (!r.ok) {
        toast.error(r.error);
        return false;
      }
      if ("undo" in r && r.undo) undoToast(r.message ?? "", r.undo, opts.onRestored);
      opts.after?.();
      router.refresh();
      return true;
    },
    [router, undoToast, workspaceSlug],
  );
}
