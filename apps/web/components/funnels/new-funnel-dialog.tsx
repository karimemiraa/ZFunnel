"use client";

import { Button } from "@zfunnel/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@zfunnel/ui/dialog";
import { FormMessage } from "@zfunnel/ui/form-message";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { cn } from "@zfunnel/ui/lib/utils";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { createFunnel } from "@/lib/funnel-actions";
import { StepTypeDot } from "./step-type";
import type { StepType } from "@/lib/funnels";

type Preset = { key: string; label: string; description: string; steps: [string, StepType][] };

export function NewFunnelDialog({
  workspaceSlug,
  presets,
  trigger,
}: {
  workspaceSlug: string;
  presets: Preset[];
  trigger?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(createFunnel.bind(null, workspaceSlug), null);
  const [preset, setPreset] = useState(presets[0]!.key);
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <PlusIcon /> New funnel
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a funnel</DialogTitle>
          <DialogDescription>
            Pick a structure. Every step starts with a ready-made page you can customize.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="funnel-name">Funnel name</Label>
            <Input id="funnel-name" name="name" placeholder="Spring Masterclass" required minLength={2} autoFocus />
            <FormMessage message={state?.fieldErrors?.name?.[0]} />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Structure</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {presets.map((p) => (
                <label
                  key={p.key}
                  className={cn(
                    "relative flex cursor-pointer flex-col gap-3 rounded-xl border p-4 transition-colors hover:border-primary/50",
                    preset === p.key && "border-primary bg-primary/[0.03] ring-4 ring-primary/20",
                  )}
                >
                  <input
                    type="radio"
                    name="preset"
                    value={p.key}
                    checked={preset === p.key}
                    onChange={() => setPreset(p.key)}
                    className="sr-only"
                  />
                  <span className="font-medium">{p.label}</span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    {p.steps.map(([name, type], i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <StepTypeDot type={type} />
                        {name}
                        {i < p.steps.length - 1 && <span className="text-muted-foreground/50">→</span>}
                      </span>
                    ))}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <FormMessage message={state?.error} />
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Create funnel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
