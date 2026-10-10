"use client";

import { Button } from "@zfunnel/ui/button";
import { FormMessage } from "@zfunnel/ui/form-message";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { Loader2Icon } from "lucide-react";
import { useActionState } from "react";
import { renameWorkspace } from "@/lib/actions";

export function RenameForm({ slug, name, disabled }: { slug: string; name: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(renameWorkspace.bind(null, slug), null);
  return (
    <form action={action} className="space-y-3">
      <Label htmlFor="name">Workspace name</Label>
      <div className="flex max-w-md gap-2">
        <Input id="name" name="name" defaultValue={name} required minLength={2} disabled={disabled} />
        <Button type="submit" disabled={pending || disabled}>
          {pending && <Loader2Icon className="animate-spin" />}
          Save
        </Button>
      </div>
      <FormMessage message={state?.fieldErrors?.name?.[0] ?? state?.error} />
      <FormMessage message={state?.success} tone="success" />
    </form>
  );
}
