"use client";

import { Button } from "@zfunnel/ui/button";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon, RefreshCwIcon, UnplugIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { connectStripe, disconnectStripe, refreshStripeStatus } from "@/lib/commerce-actions";

export function PaymentsActions({
  workspaceSlug,
  connected,
  canManage,
  stripeReady,
}: {
  workspaceSlug: string;
  connected: boolean;
  canManage: boolean;
  stripeReady: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  if (!canManage)
    return <p className="text-sm text-muted-foreground">Only owners and admins can change payment settings.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={busy || !stripeReady}
        onClick={() =>
          start(async () => {
            try {
              await connectStripe(workspaceSlug);
            } catch (e) {
              if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
              toast.error((e as Error).message);
            }
          })
        }
      >
        {busy && <Loader2Icon className="animate-spin" />}
        {connected ? "Continue Stripe setup" : "Connect with Stripe"}
      </Button>
      {connected && (
        <>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const r = await refreshStripeStatus(workspaceSlug);
                if (r.ok) toast.success("Status updated");
                else toast.error(r.error);
                router.refresh();
              })
            }
          >
            <RefreshCwIcon /> Refresh status
          </Button>
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={busy}
            onClick={() => {
              if (confirm("Disconnect Stripe? Checkouts stop accepting payments until you reconnect."))
                start(async () => {
                  await disconnectStripe(workspaceSlug);
                  toast.success("Stripe disconnected");
                  router.refresh();
                });
            }}
          >
            <UnplugIcon /> Disconnect
          </Button>
        </>
      )}
    </div>
  );
}
