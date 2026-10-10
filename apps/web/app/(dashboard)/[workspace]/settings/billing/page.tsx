import { Badge } from "@zfunnel/ui/badge";
import { cn } from "@zfunnel/ui/lib/utils";
import { FEATURE_LABELS, LIMIT_LABELS, PAID_PLANS, type FeatureKey, type LimitKey } from "@zfunnel/shared";
import { CheckIcon, CircleCheckBigIcon, MinusIcon } from "lucide-react";
import { PlanButton, PortalButton } from "@/components/billing/plan-button";
import { getBillingState, getUsage } from "@/lib/billing";
import { requireWorkspace } from "@/lib/context";
import { canManage } from "@/lib/workspaces";

export const metadata = { title: "Billing" };

const money = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmt = (n: number | null) => (n === null ? "Unlimited" : n.toLocaleString());
const unit = (k: LimitKey, n: number | null) => {
  const label = LIMIT_LABELS[k].replace(" this month", "/month").toLowerCase();
  return n === 1 ? label.replace(/s(\/month)?$/, "$1") : label;
};

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

  return (
    <div className="grid gap-8">
      {success && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-300/60 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <CircleCheckBigIcon className="size-5" />
          <span>Thank you! Your plan is active. It can take a few seconds for the change to show.</span>
        </div>
      )}

      <section className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-6">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{ctx.membership.organizationName} is on</p>
          <div className="mt-1 flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">{state.plan.name}</h2>
            {state.status === "trial" && <Badge variant="default">{state.daysLeft} days left</Badge>}
            {state.status === "expired" && <Badge variant="warning">Trial ended</Badge>}
            {state.status === "past_due" && <Badge variant="warning">Payment failed</Badge>}
            {state.status === "active" && <Badge variant="success">Active</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.status === "trial"
              ? `Your free trial includes everything. It ends on ${state.trialEndsAt!.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`
              : state.status === "expired"
                ? "Choose a plan to keep building. Your published funnels stay live."
                : state.row?.cancelAtPeriodEnd && state.row.currentPeriodEnd
                  ? `Cancelled. Access until ${state.row.currentPeriodEnd.toLocaleDateString()}.`
                  : state.row?.currentPeriodEnd
                    ? `Renews on ${state.row.currentPeriodEnd.toLocaleDateString()} · ${money(state.plan.monthly)}/month`
                    : `${money(state.plan.monthly)}/month${state.row?.provider === "test" ? " · test mode" : ""}`}
          </p>
        </div>
        {manager && state.row?.provider === "stripe" && state.row.stripeCustomerId && (
          <PortalButton workspaceSlug={ws} />
        )}
      </section>

      <section>
        <h3 className="mb-3 font-semibold">Usage</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(LIMIT_LABELS) as LimitKey[]).map((k) => {
            const limit = state.plan.limits[k];
            const used = usage[k];
            const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
            return (
              <div key={k} className="rounded-xl border bg-card p-4">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">{LIMIT_LABELS[k]}</span>
                  <span className="font-medium tabular-nums">
                    {used.toLocaleString()} <span className="text-muted-foreground">/ {fmt(limit)}</span>
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                  role="meter"
                  aria-valuenow={used}
                  aria-valuemax={limit ?? undefined}
                  aria-label={LIMIT_LABELS[k]}
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
        <h3 className="mb-3 font-semibold">Plans</h3>
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
                    Most popular
                  </span>
                )}
                <h4 className="text-lg font-semibold">{p.name}</h4>
                <p className="text-sm text-muted-foreground">{p.tagline}</p>
                <p className="mt-4">
                  <span className="text-4xl font-bold tracking-tight">{money(p.monthly)}</span>
                  <span className="text-muted-foreground">/month</span>
                </p>
                <ul className="mt-5 mb-6 grid gap-2 text-sm">
                  {(Object.keys(LIMIT_LABELS) as LimitKey[]).map((k) => (
                    <li key={k} className="flex items-center gap-2">
                      <CheckIcon className="size-4 text-primary" />
                      <span>
                        <strong className="font-semibold">{fmt(p.limits[k])}</strong> {unit(k, p.limits[k])}
                      </span>
                    </li>
                  ))}
                  {(Object.keys(FEATURE_LABELS) as FeatureKey[]).map((f) => (
                    <li key={f} className={cn("flex items-center gap-2", !p.features[f] && "text-muted-foreground")}>
                      {p.features[f] ? <CheckIcon className="size-4 text-primary" /> : <MinusIcon className="size-4" />}
                      {FEATURE_LABELS[f]}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {isCurrent ? (
                    <div className="rounded-md border py-2 text-center text-sm font-medium text-muted-foreground">
                      Current plan
                    </div>
                  ) : manager ? (
                    <PlanButton
                      workspaceSlug={ws}
                      plan={p.id}
                      label={current ? `Switch to ${p.name}` : `Choose ${p.name}`}
                      variant={popular ? "default" : "outline"}
                    />
                  ) : (
                    <p className="text-center text-xs text-muted-foreground">
                      Ask an owner or admin to change the plan.
                    </p>
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
