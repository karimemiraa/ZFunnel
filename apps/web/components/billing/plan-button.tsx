"use client";

import { Button } from "@zfunnel/ui/button";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon } from "lucide-react";
import { useTransition } from "react";
import { choosePlan, openBillingPortal } from "@/lib/billing-actions";
import type { PlanId } from "@zfunnel/shared";

export function PlanButton({
  workspaceSlug,
  plan,
  label,
  variant,
}: {
  workspaceSlug: string;
  plan: PlanId;
  label: string;
  variant?: "default" | "outline";
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      className="w-full"
      variant={variant}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await choosePlan(workspaceSlug, plan);
          if (r && !r.ok) toast.error(r.error);
        })
      }
    >
      {pending && <Loader2Icon className="animate-spin" />} {label}
    </Button>
  );
}

export function PortalButton({ workspaceSlug }: { workspaceSlug: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await openBillingPortal(workspaceSlug);
          if (r && !r.ok) toast.error(r.error);
        })
      }
    >
      {pending && <Loader2Icon className="animate-spin" />} Manage billing
    </Button>
  );
}
