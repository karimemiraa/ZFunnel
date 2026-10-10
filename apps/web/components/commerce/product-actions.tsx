"use client";

import { Button } from "@zfunnel/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@zfunnel/ui/dropdown-menu";
import { toast } from "@zfunnel/ui/toaster";
import { ArchiveIcon, MoreHorizontalIcon } from "lucide-react";
import { useT } from "@zfunnel/i18n/react";
import { useTransition } from "react";
import { archiveProduct } from "@/lib/commerce-actions";

export function ProductActions({
  workspaceSlug,
  productId,
  name,
}: {
  workspaceSlug: string;
  productId: string;
  name: string;
}) {
  const t = useT();
  const [, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("products.actionsAria", { name })}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            if (confirm(t("products.archiveConfirm", { name })))
              start(async () => {
                await archiveProduct(workspaceSlug, productId);
                toast.success(t("products.archived"));
              });
          }}
        >
          <ArchiveIcon /> {t("products.archive")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
