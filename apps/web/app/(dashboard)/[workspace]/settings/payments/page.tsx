import { stripeConfigured, testModeEnabled } from "@zfunnel/payments";
import { Badge } from "@zfunnel/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { CheckCircle2Icon, CircleAlertIcon, FlaskConicalIcon } from "lucide-react";
import { PaymentsActions } from "@/components/commerce/payments-settings";
import { getPaymentAccount } from "@/lib/commerce";
import { requireWorkspace } from "@/lib/context";
import { getT } from "@/lib/i18n";
import { canManage } from "@/lib/workspaces";

export async function generateMetadata() {
  return { title: (await getT())("settings.tabs.payments") };
}

export default async function PaymentsSettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const acct = await getPaymentAccount(ctx);
  const ready = acct?.chargesEnabled;
  const t = await getT();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <svg viewBox="0 0 60 25" className="h-5 w-auto" aria-label="Stripe" role="img">
                <path
                  fill="#635BFF"
                  d="M59.6 14.3c0-4.3-2.1-7.7-6.1-7.7-4 0-6.4 3.4-6.4 7.7 0 5 2.8 7.6 6.9 7.6 2 0 3.5-.5 4.6-1.1v-3.4c-1.1.6-2.4 1-4.1 1-1.6 0-3-.6-3.2-2.5h8.2l.1-1.6zm-8.3-1.6c0-1.9 1.1-2.6 2.2-2.6 1 0 2.1.7 2.1 2.6h-4.3zM40.6 6.6c-1.6 0-2.7.8-3.3 1.3l-.2-1.1h-3.7v20l4.2-.9v-4.8c.6.4 1.5 1.1 3 1.1 3 0 5.8-2.4 5.8-7.8 0-4.9-2.8-7.8-5.8-7.8zm-1 11.6c-1 0-1.6-.4-2-.8v-6.3c.4-.5 1-.8 2-.8 1.5 0 2.6 1.7 2.6 3.9 0 2.3-1 4-2.6 4zM27.6 5.6l4.2-.9V1.3l-4.2.9v3.4zM27.6 6.9h4.2v14.7h-4.2zM23.1 8.1l-.3-1.2h-3.6v14.7h4.2v-10c1-1.3 2.7-1.1 3.2-.9V6.9c-.5-.2-2.5-.6-3.5 1.2zM14.7 3.2l-4.1.9v13.5c0 2.5 1.9 4.3 4.4 4.3 1.4 0 2.4-.3 3-.6v-3.4c-.5.2-3.1 1-3.1-1.5v-6h3.1V6.9h-3.1l-.2-3.7zM4.3 11.1c0-.7.5-.9 1.4-.9 1.3 0 2.9.4 4.1 1.1V7.4c-1.4-.6-2.8-.8-4.1-.8C2.4 6.6.2 8.3.2 11.3c0 4.6 6.3 3.9 6.3 5.9 0 .8-.7 1-1.6 1-1.4 0-3.2-.6-4.6-1.4v4c1.6.7 3.1 1 4.6 1 3.4 0 5.7-1.7 5.7-4.7 0-4.9-6.3-4.1-6.3-6z"
                />
              </svg>
              {t("settings.tabs.payments")}
            </CardTitle>
            {acct ? (
              ready ? (
                <Badge variant="success">{t("payments.accepting")}</Badge>
              ) : (
                <Badge variant="warning">{t("payments.setupIncomplete")}</Badge>
              )
            ) : (
              <Badge variant="secondary">{t("payments.notConnected")}</Badge>
            )}
          </div>
          <CardDescription>{t("payments.description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {acct && (
            <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4 text-sm">
              {ready ? (
                <CheckCircle2Icon className="mt-0.5 size-5 text-emerald-500" />
              ) : (
                <CircleAlertIcon className="mt-0.5 size-5 text-amber-500" />
              )}
              <div>
                <div className="font-medium">{acct.displayName ?? t("payments.stripeAccount")}</div>
                <div className="text-muted-foreground">
                  <span dir="ltr">{acct.externalId}</span> ·{" "}
                  {acct.livemode ? t("payments.liveMode") : t("payments.testMode")} ·{" "}
                  {ready ? t("payments.chargesEnabled") : t("payments.finishOnboarding")}
                </div>
              </div>
            </div>
          )}
          {!stripeConfigured() && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
              {t("payments.adminKeys")} (<code>STRIPE_SECRET_KEY</code>, <code>STRIPE_PUBLISHABLE_KEY</code>).
            </p>
          )}
          <PaymentsActions
            workspaceSlug={ctx.workspace.slug}
            connected={Boolean(acct)}
            canManage={canManage(ctx.membership.role)}
            stripeReady={stripeConfigured()}
          />
        </CardContent>
      </Card>
      {testModeEnabled() && !ready && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConicalIcon className="size-5 text-amber-500" /> {t("payments.testModeOn")}
            </CardTitle>
            <CardDescription>{t("payments.testModeBody")}</CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
