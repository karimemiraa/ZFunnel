"use client";

import { Button } from "@zfunnel/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@zfunnel/ui/dropdown-menu";
import { toast } from "@zfunnel/ui/toaster";
import { ArchiveIcon, MoreHorizontalIcon } from "lucide-react";
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
  const [, start] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${name}`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            if (confirm(`Archive “${name}”? It's removed from all funnel steps. Past orders are kept.`))
              start(async () => {
                await archiveProduct(workspaceSlug, productId);
                toast.success("Product archived");
              });
          }}
        >
          <ArchiveIcon /> Archive
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
