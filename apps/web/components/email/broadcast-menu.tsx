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
import { deleteBroadcast } from "@/lib/email-actions";
import { duplicateBroadcast } from "@/lib/records-actions";

/** Duplicate a broadcast (as a new draft) or delete it after showing where its email is used. */
export function BroadcastMenu({
  workspaceSlug,
  broadcastId,
  emailId,
  name,
  canDelete,
}: {
  workspaceSlug: string;
  broadcastId: string;
  emailId: string;
  name: string;
  canDelete: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [, start] = useTransition();
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("records.email.actionsAria", { name })}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() =>
              start(async () => {
                const r = await duplicateBroadcast(workspaceSlug, broadcastId);
                if (r.ok && r.id) {
                  toast.success(r.message ?? "");
                  router.push(`/${workspaceSlug}/email/${r.id}`);
                } else if (!r.ok) toast.error(r.error);
              })
            }
          >
            <CopyPlusIcon /> {t("records.duplicate")}
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                <Trash2Icon /> {t("common.delete")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteDialog
        workspaceSlug={workspaceSlug}
        usedInKind="email"
        id={emailId}
        name={name}
        undoable={false}
        open={deleting}
        onOpenChange={setDeleting}
        onConfirm={() => deleteBroadcast(workspaceSlug, broadcastId)}
      />
    </>
  );
}
