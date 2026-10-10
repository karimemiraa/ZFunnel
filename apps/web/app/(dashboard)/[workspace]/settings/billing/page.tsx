import { Badge } from "@zfunnel/ui/badge";
import { cn } from "@zfunnel/ui/lib/utils";
import { intlLocale } from "@zfunnel/i18n";
import {
  FEATURE_LABELS,
  LIMIT_LABELS,
  PAID_PLANS,
  TRIAL_DAYS,
  type FeatureKey,
  type LimitKey,
  type PlanId,
} from "@zfunnel/shared";
import { CheckIcon, CircleCheckBigIcon, MinusIcon } from "lucide-react";
import { PlanButton, PortalButton } from "@/components/billing/plan-button";
import { getBillingState, getUsage } from "@/lib/billing";
import { requireWorkspace } from "@/lib/context";
import { getLocale, getT } from "@/lib/i18n";
import { canManage } from "@/lib/workspaces";

export async function generateMetadata() {
  return { title: (await getT())("settings.tabs.billing") };
}

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ success?: string }>;
}) {
  const ctx = await requireWorkspace(params);
  const { success } = await searchParams;
  const orgId = ctx.membership.organizationId;
  const [state, usage] = await Promise.all([getBillingState(orgId), getUsage(orgId)]);
  const ws = ctx.workspace.slug;
  const manager = canManage(ctx.membership.role);
  const current = state.status === "active" || state.status === "past_due" ? state.plan.id : null;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const tag = intlLocale(locale);
  const money = (cents: number) => `$${(cents / 100).toLocaleString(tag, { maximumFractionDigits: 0 })}`;
  const num = (n: number) => n.toLocaleString(tag);
  const planName = (id: PlanId) => t(`billing.planNames.${id}`);
  const limitLine = (k: LimitKey, n: number | null) =>
    n === null ? (
      <>
        <strong className="font-semibold">{t("billing.unlimited")}</strong> {t(`billing.limitsLower.${k}`)}
      </>
    ) : (
      <>
        <strong className="font-semibold">{num(n)}</strong> {t(`billing.units.${k}`, { count: n })}
      </>
    );

  return (
    <div className="grid gap-8">
      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <CircleCheckBigIcon className="size-5" />
          <span>{t("billing.thanks")}</span>
        </div>
      )}

      <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            {t("billing.isOn", { organization: ctx.membership.organizationName })}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">{planName(state.plan.id)}</h2>
            {state.status === "trial" && (
              <Badge variant="default">{t("billing.daysLeft", { count: state.daysLeft ?? 0 })}</Badge>
            )}
            {state.status === "expired" && <Badge variant="warning">{t("billing.trialEnded")}</Badge>}
            {state.status === "past_due" && <Badge variant="warning">{t("billing.paymentFailed")}</Badge>}
            {state.status === "active" && <Badge variant="success">{t("billing.active")}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.status === "trial"
              ? t("billing.trialIncludes", {
                  date: state.trialEndsAt!.toLocaleDateString(tag, { month: "long", day: "numeric" }),
                })
              : state.status === "expired"
                ? t("billing.expiredHint")
                : state.row?.cancelAtPeriodEnd && state.row.currentPeriodEnd
                  ? t("billing.cancelled", { date: state.row.currentPeriodEnd.toLocaleDateString(tag) })
                  : state.row?.currentPeriodEnd
                    ? t("billing.renews", {
                        date: state.row.currentPeriodEnd.toLocaleDateString(tag),
                        price: money(state.plan.monthly),
                      })
                    : `${t("billing.perMonth", { price: money(state.plan.monthly) })}${state.row?.provider === "test" ? t("billing.testModeSuffix") : ""}`}
          </p>
        </div>
        {manager && state.row?.provider === "stripe" && state.row.stripeCustomerId && (
          <PortalButton workspaceSlug={ws} />
        )}
      </section>

      <section>
        <h3 className="mb-3 font-semibold">{t("billing.usage")}</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(LIMIT_LABELS) as LimitKey[]).map((k) => {
            const limit = state.plan.limits[k];
            const used = usage[k];
            const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            return (
              <div key={k} className="rounded-xl border bg-card p-4">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">{t(`billing.limits.${k}`)}</span>
                  <span className="font-medium tabular-nums">
                    {num(used)}{" "}
                    <span className="text-muted-foreground">
                      / {limit === null ? t("billing.unlimited") : num(limit)}
                    </span>
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="meter"
                  aria-valuenow={used}
                  aria-valuemax={limit ?? undefined}
                  aria-label={t(`billing.limits.${k}`)}
                >
                  <div
                    className={cn(
                      "h-full rounded-full",
                      limit !== null && used > limit ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-primary",
                    )}
                    style={{ width: `${limit === null ? 0 : Math.max(pct, used ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 font-semibold">{t("billing.plans")}</h3>
        <div className="grid gap-4 lg:grid-cols-3">
          {PAID_PLANS.map((p) => {
            const popular = p.id === "pro";
            const isCurrent = current === p.id;
            return (
              <div
                key={p.id}
                className={cn(
                  "relative flex flex-col rounded-2xl border bg-card p-6",
                  popular && "border-primary shadow-lg ring-1 ring-primary",
                )}
              >
                {popular && (
                  <span className="absolute start-6 -top-3 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                    {t("billing.mostPopular")}
                  </span>
                )}
                <h4 className="text-lg font-semibold">{planName(p.id)}</h4>
                <p className="text-sm text-muted-foreground">{t(`billing.taglines.${p.id}`, { days: TRIAL_DAYS })}</p>
                <p className="mt-4">
                  <span className="text-4xl font-bold tracking-tight">{money(p.monthly)}</span>
                  <span className="text-muted-foreground">{t("billing.monthSuffix")}</span>
                </p>
                <ul className="mt-5 mb-6 grid gap-2 text-sm">
                  {(Object.keys(LIMIT_LABELS) as LimitKey[]).map((k) => (
                    <li key={k} className="flex items-center gap-2">
                      <CheckIcon className="size-4 text-primary" />
                      <span>{limitLine(k, p.limits[k])}</span>
                    </li>
                  ))}
                  {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((f) => (
                    <li key={f} className={cn("flex items-center gap-2", !p.features[f] && "text-muted-foreground")}>
                      {p.features[f] ? <CheckIcon className="size-4 text-primary" /> : <MinusIcon className="size-4" />}
                      {t(`billing.features.${f}`)}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {isCurrent ? (
                    <div className="rounded-md border py-2 text-center text-sm font-medium text-muted-foreground">
                      {t("billing.currentPlan")}
                    </div>
                  ) : manager ? (
                    <PlanButton
                      workspaceSlug={ws}
                      plan={p.id}
                      label={
                        current
                          ? t("billing.switchTo", { plan: planName(p.id) })
                          : t("billing.choose", { plan: planName(p.id) })
                      }
                      variant={popular ? "default" : "outline"}
                    />
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">{t("billing.askOwner")}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
