"use client";

import { Button } from "@zfunnel/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zfunnel/ui/dropdown-menu";
import { toast } from "@zfunnel/ui/toaster";
import { CopyPlusIcon, EyeIcon, MoreHorizontalIcon, Trash2Icon } from "lucide-react";
import { useT } from "@zfunnel/i18n/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DeleteDialog } from "@/components/records/delete-dialog";
import { duplicateProduct } from "@/lib/records-actions";

/** Row menu on the products list and the product page: open, duplicate, delete (with "Used in"). */
export function ProductActions({
  workspaceSlug,
  productId,
  name,
  after,
  showOpen = true,
}: {
  workspaceSlug: string;
  productId: string;
  name: string;
  after?: "list";
  showOpen?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [, start] = useTransition();
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={t("products.actionsAria", { name })}>
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {showOpen && (
            <DropdownMenuItem asChild>
              <Link href={`/${workspaceSlug}/products/${productId}`}>
                <EyeIcon /> {t("records.product.open")}
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onSelect={() =>
              start(async () => {
                const r = await duplicateProduct(workspaceSlug, productId);
                if (r.ok && r.id) {
                  toast.success(r.message ?? "");
                  router.push(`/${workspaceSlug}/products/${r.id}`);
                } else if (!r.ok) toast.error(r.error);
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
        kind="product"
        usedInKind="product"
        id={productId}
        name={name}
        open={deleting}
        onOpenChange={setDeleting}
        after={after === "list" ? () => router.push(`/${workspaceSlug}/products`) : undefined}
      />
    </>
  );
}
