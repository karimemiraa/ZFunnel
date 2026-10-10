"use client";

import { useT } from "@zfunnel/i18n/react";
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
import { STEP_COLORS, STEP_TYPES, stepLabelKey } from "./step-type";

export function AddStepDialog({ workspaceSlug, funnelId }: { workspaceSlug: string; funnelId: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<StepType>("optin");
  const [name, setName] = useState(() => t(stepLabelKey("optin")));
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
          <PlusIcon /> {t("funnels.addStep")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("funnels.addStepTitle")}</DialogTitle>
          <DialogDescription>{t("funnels.addStepDescription")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {STEP_TYPES.map((st) => (
              <label
                key={st}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors",
                  type === st ? "border-primary bg-primary/5 font-medium" : "hover:border-foreground/20",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={st}
                  checked={type === st}
                  onChange={() => {
                    setType(st);
                    setName(t(stepLabelKey(st)));
                  }}
                  className="sr-only"
                />
                <span className="size-2.5 rounded-full" style={{ background: STEP_COLORS[st] }} />
                {t(stepLabelKey(st))}
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="step-name">{t("funnels.stepName")}</Label>
            <Input id="step-name" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
            <FormMessage message={state?.fieldErrors?.name?.[0] ?? state?.error} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {t("funnels.addStep")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
