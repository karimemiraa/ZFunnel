"use client";

import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zfunnel/ui/dropdown-menu";
import { toast } from "@zfunnel/ui/toaster";
import { CopyPlusIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DeleteDialog } from "@/components/records/delete-dialog";
import { duplicateWorkflow } from "@/lib/records-actions";

/** Duplicate (as a draft) or delete (with "Used in" and undo) an automation. */
export function AutomationMenu({ workspaceSlug, id, name }: { workspaceSlug: string; id: string; name: string }) {
  const t = useT();
  const router = useRouter();
  const [, start] = useTransition();
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("records.automation.actionsAria", { name })}
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              start(async () => {
                const r = await duplicateWorkflow(workspaceSlug, id);
                if (r.ok) {
                  toast.success(r.message ?? "");
                  router.refresh();
                } else toast.error(r.error);
              })
            }
          >
            <CopyPlusIcon /> {t("records.duplicate")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2Icon /> {t("common.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteDialog
        workspaceSlug={workspaceSlug}
        kind="workflow"
        usedInKind="automation"
        id={id}
        name={name}
        open={deleting}
        onOpenChange={setDeleting}
      />
    </>
  );
}
