"use client";

import { Button } from "@zfunnel/ui/button";
import { toast } from "@zfunnel/ui/toaster";
import { useT } from "@zfunnel/i18n/react";
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
  const t = useT();
  const router = useRouter();
  const [busy, start] = useTransition();
  if (!canManage) return <p className="text-sm text-muted-foreground">{t("payments.onlyAdmins")}</p>;
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
        {connected ? t("payments.continueSetup") : t("payments.connect")}
      </Button>
      {connected && (
        <>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              start(async () => {
                const r = await refreshStripeStatus(workspaceSlug);
                if (r.ok) toast.success(t("payments.statusUpdated"));
                else toast.error(r.error);
                router.refresh();
              })
            }
          >
            <RefreshCwIcon /> {t("payments.refresh")}
          </Button>
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={busy}
            onClick={() => {
              if (confirm(t("payments.disconnectConfirm")))
                start(async () => {
                  await disconnectStripe(workspaceSlug);
                  toast.success(t("payments.disconnected"));
                  router.refresh();
                });
            }}
          >
            <UnplugIcon /> {t("payments.disconnect")}
          </Button>
        </>
      )}
    </div>
  );
}
