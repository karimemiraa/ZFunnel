"use client";

import { slugify } from "@zfunnel/shared";
import { Button } from "@zfunnel/ui/button";
import { FormMessage } from "@zfunnel/ui/form-message";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { Loader2Icon } from "lucide-react";
import { useActionState, useState } from "react";
import type { ActionState } from "@/lib/actions";

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  rootDomain: string;
  submitLabel: string;
  /** Ask for the business/organization name (first-run onboarding only). */
  askOrganization?: boolean;
  organizations?: { id: string; name: string }[];
};

export function WorkspaceForm({ action, rootDomain, submitLabel, askOrganization, organizations }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {askOrganization && (
        <div className="space-y-2">
          <Label htmlFor="organization">Business name</Label>
          <Input id="organization" name="organization" placeholder="Acme Coaching LLC" required minLength={2} />
          <FormMessage message={errors.organization?.[0]} />
        </div>
      )}
      {organizations && organizations.length > 1 && (
        <div className="space-y-2">
          <Label htmlFor="organizationId">Organization</Label>
          <select
            id="organizationId"
            name="organizationId"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {organizations?.length === 1 && <input type="hidden" name="organizationId" value={organizations[0]!.id} />}
      <div className="space-y-2">
        <Label htmlFor="name">Workspace name</Label>
        <Input
          id="name"
          name="name"
          placeholder="Acme Coaching"
          required
          minLength={2}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
        />
        <p className="text-xs text-muted-foreground">One workspace per brand or business. You can add more later.</p>
        <FormMessage message={errors.name?.[0]} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="slug">Free subdomain</Label>
        <div className="flex items-center rounded-md border border-input focus-within:ring-[3px] focus-within:ring-ring/50">
          <input
            id="slug"
            name="slug"
            required
            className="h-9 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none"
            value={slug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
          <span className="border-s px-3 text-sm text-muted-foreground">.{rootDomain}</span>
        </div>
        <FormMessage message={errors.slug?.[0]} />
      </div>
      <FormMessage message={state?.error} />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        {submitLabel}
      </Button>
    </form>
  );
}
