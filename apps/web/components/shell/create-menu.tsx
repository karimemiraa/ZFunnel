"use client";

import { Button } from "@zfunnel/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@zfunnel/ui/dropdown-menu";
import { useT } from "@zfunnel/i18n/react";
import type { MessageKey } from "@zfunnel/i18n";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { CREATE_ITEMS, createHref, findModule } from "@/lib/nav";
import { useShell } from "./shell-provider";

/** Global "+ Create" menu in the top bar (ROADMAP 8.1). The "c" shortcut opens it. */
export function CreateMenu() {
  const t = useT();
  const { workspaceSlug, createOpen, setCreateOpen } = useShell();
  return (
    <DropdownMenu open={createOpen} onOpenChange={setCreateOpen}>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5" aria-label={t("topbar.createMenu")} data-create-menu>
          <PlusIcon />
          <span className="hidden sm:inline">{t("topbar.create")}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex items-center text-xs text-muted-foreground">
          {t("topbar.createMenu")}
          <DropdownMenuShortcut>C</DropdownMenuShortcut>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {CREATE_ITEMS.map((item) => {
          const Icon = findModule(item.segment)!.icon;
          return (
            <DropdownMenuItem key={item.id} asChild>
              <Link href={createHref(workspaceSlug, item)} data-create={item.id}>
                <Icon /> {t(`topbar.createItems.${item.id}` as MessageKey)}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
