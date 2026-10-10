"use client";

import { Button } from "@zfunnel/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zfunnel/ui/dropdown-menu";
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

export type SwitcherGroup = { organizationName: string; workspaces: { slug: string; name: string }[] };

function Initial({ name }: { name: string }) {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-semibold text-primary">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export function WorkspaceSwitcher({
  current,
  groups,
}: {
  current: { slug: string; name: string };
  groups: SwitcherGroup[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-10 w-full justify-start gap-2 px-2" aria-label="Switch workspace">
          <Initial name={current.name} />
          <span className="flex-1 truncate text-left">{current.name}</span>
          <ChevronsUpDownIcon className="text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="start">
        {groups.map((group) => (
          <div key={group.organizationName}>
            <DropdownMenuLabel className="text-xs text-muted-foreground">{group.organizationName}</DropdownMenuLabel>
            {group.workspaces.map((w) => (
              <DropdownMenuItem key={w.slug} asChild>
                <Link href={`/${w.slug}`}>
                  <Initial name={w.name} />
                  <span className="flex-1 truncate">{w.name}</span>
                  {w.slug === current.slug && <CheckIcon />}
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/workspaces/new">
            <PlusIcon /> New workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
