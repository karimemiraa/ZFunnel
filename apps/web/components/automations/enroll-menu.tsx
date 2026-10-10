"use client";

import { Button } from "@zfunnel/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@zfunnel/ui/dropdown-menu";
import { toast } from "@zfunnel/ui/toaster";
import { WorkflowIcon } from "lucide-react";
import Link from "next/link";
import { enrollContact } from "@/lib/automation-actions";

export function EnrollMenu({
  workspaceSlug,
  contactId,
  workflows,
}: {
  workspaceSlug: string;
  contactId: string;
  workflows: { id: string; name: string }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <WorkflowIcon /> Add to automation
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Live automations</DropdownMenuLabel>
        {workflows.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onClick={async () => {
              const r = await enrollContact(workspaceSlug, contactId, w.id);
              if (r.ok) toast.success(r.message ?? "Added");
              else toast.error(r.error);
            }}
          >
            {w.name}
          </DropdownMenuItem>
        ))}
        {!workflows.length && (
          <DropdownMenuItem asChild>
            <Link href={`/${workspaceSlug}/automations`}>No live automations yet. Create one →</Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
