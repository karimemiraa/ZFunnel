"use client";

import { Button } from "@zfunnel/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@zfunnel/ui/dialog";
import { FormMessage } from "@zfunnel/ui/form-message";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { cn } from "@zfunnel/ui/lib/utils";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useActionState, useState } from "react";
import { addStep, type FormState } from "@/lib/funnel-actions";
import type { StepType } from "@/lib/funnels";
import { STEP_COLORS, STEP_LABELS } from "./step-type";

const TYPES: StepType[] = ["optin", "sales", "checkout", "upsell", "downsell", "thankyou", "page"];

export function AddStepDialog({ workspaceSlug, funnelId }: { workspaceSlug: string; funnelId: string }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<StepType>("optin");
  const [name, setName] = useState(STEP_LABELS.optin);
  const [state, action, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await addStep(workspaceSlug, funnelId, prev, formData);
    if (result?.success) {
      toast.success(result.success);
      setOpen(false);
    }
    return result;
  }, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full border-dashed">
          <PlusIcon /> Add step
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a step</DialogTitle>
          <DialogDescription>It&apos;s added at the end of the funnel with a pre-designed page.</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TYPES.map((t) => (
              <label
                key={t}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors",
                  type === t ? "border-primary bg-primary/5 font-medium" : "hover:border-foreground/20",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => {
                    setType(t);
                    setName(STEP_LABELS[t]);
                  }}
                  className="sr-only"
                />
                <span className="size-2.5 rounded-full" style={{ background: STEP_COLORS[t] }} />
                {STEP_LABELS[t]}
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="step-name">Step name</Label>
            <Input id="step-name" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
            <FormMessage message={state?.fieldErrors?.name?.[0] ?? state?.error} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Add step
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
