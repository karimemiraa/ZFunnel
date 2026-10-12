import { Button } from "@zfunnel/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { cn } from "@zfunnel/ui/lib/utils";
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CalendarCheckIcon,
  CheckCircle2Icon,
  CircleIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  FileClockIcon,
  GlobeIcon,
  MessageCircleIcon,
  PartyPopperIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  TargetIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UserPlusIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { BarChart } from "@/components/bar-chart";
import { PageHeader } from "@/components/page-header";
import { GoalDialog } from "@/components/today/goal-dialog";
import { HideChecklist } from "@/components/today/hide-checklist";
import { KpiTiles } from "@/components/today/kpi-tiles";
import { requireWorkspace } from "@/lib/context";
import { ROOT_DOMAIN } from "@/lib/env";
import { getFmt, getT } from "@/lib/i18n";
import { todayData, UNANSWERED_HOURS, type AttentionItem, type TodayData } from "@/lib/today";
import { monthKey } from "@/lib/today-math";
import { canManage } from "@/lib/workspaces";

export async function generateMetadata() {
  return { title: (await getT())("overview.title") };
}

type T = Awaited<ReturnType<typeof getT>>;
type F = Awaited<ReturnType<typeof getFmt>>;

export default async function TodayPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const { user, workspace, membership } = ctx;
  const [t, f, data, jar] = await Promise.all([getT(), getFmt(), todayData(ctx), cookies()]);
  const ws = workspace.slug;
  const editable = canManage(membership.role);
  const month = monthKey(new Date());

  const steps = [
    { done: true, label: t("overview.stepWorkspace") },
    { done: data.state.stripe, label: t("overview.stepPayments") },
    { done: data.state.funnels > 0, label: t("overview.stepFunnel") },
    { done: data.state.domains > 0, label: t("overview.stepDomain") },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const showChecklist = doneCount < steps.length && !jar.get(`zf_hide_onboarding_${ws}`);
  const siteUrl = `${ws}.${ROOT_DOMAIN}`;
  const hasSales = data.series.some((d) => d.value > 0);
  const goalProps = {
    slug: ws,
    goals: data.goals.map((g) => ({ month: g.month, amount: g.amount, currency: g.currency })),
    currentMonth: month,
    defaultCurrency: data.currency,
    disabled: !editable,
  };

  return (
    <>
      <PageHeader
        title={t("overview.welcome", { name: user.name.split(" ")[0]! })}
        description={t("overview.happening", { workspace: workspace.name })}
        actions={
          <a
            href={`${ROOT_DOMAIN.startsWith("localhost") ? "http" : "https"}://${siteUrl}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            dir="ltr"
          >
            {siteUrl} <ExternalLinkIcon className="size-3.5" />
          </a>
        }
      />

      {showChecklist && (
        <Card className="mb-8 overflow-hidden" data-testid="onboarding">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
              <div className="space-y-1.5">
                <CardTitle className="text-lg">{t("overview.gettingStarted")}</CardTitle>
                <CardDescription>{t("overview.gettingStartedHint")}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground tabular-nums">
                  {t("overview.progress", { done: doneCount, total: steps.length })}
                </span>
                <HideChecklist slug={ws} />
              </div>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-brand-orange transition-[width]"
                style={{ width: `${(doneCount / steps.length) * 100}%` }}
              />
            </div>
            <ol className="mt-5 grid gap-3 sm:grid-cols-2">
              {steps.map((s) => (
                <li key={s.label} className="flex items-center gap-3 text-sm">
                  {s.done ? (
                    <CheckCircle2Icon className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <CircleIcon className="size-5 shrink-0 text-muted-foreground" />
                  )}
                  <span className={cn(s.done && "text-muted-foreground line-through")}>{s.label}</span>
                </li>
              ))}
            </ol>
          </CardHeader>
        </Card>
      )}

      <KpiTiles periods={data.periods} currency={data.currency} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("today.trendTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {hasSales ? (
              <BarChart data={data.series} unit={{ currency: data.currency }} label={t("today.trendTitle")} />
            ) : (
              <p className="flex h-44 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
                {t("today.trendEmpty")}
              </p>
            )}
          </CardContent>
        </Card>
        <GoalCard data={data} t={t} f={f} goalProps={goalProps} editable={editable} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("today.attention.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.attention.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2Icon className="size-4 text-emerald-600 dark:text-emerald-400" />
                {t("today.attention.allClear")}
              </p>
            ) : (
              <ul className="-mx-2 space-y-0.5" data-testid="attention">
                {data.attention.map((item, i) => {
                  const a = attention(item, ws, t, f);
                  return (
                    <li key={i}>
                      <Link
                        href={a.href}
                        className="group flex items-start gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted"
                      >
                        <a.icon
                          className={cn(
                            "mt-0.5 size-4 shrink-0",
                            a.severe ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400",
                          )}
                          aria-hidden
                        />
                        <span className="flex-1">{a.text}</span>
                        <ArrowRightIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("today.recent.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("today.recent.empty")}</p>
            ) : (
              <ul className="-mx-2 space-y-0.5" data-testid="recent">
                {data.recent.map((r, i) => {
                  const [Icon, href, title, value] =
                    r.kind === "order"
                      ? ([
                          ShoppingBagIcon,
                          `/${ws}/orders/${r.id}`,
                          t("today.recent.order", { number: String(r.number) }),
                          f.money(r.amount, r.currency),
                        ] as const)
                      : r.kind === "lead"
                        ? ([UserPlusIcon, `/${ws}/contacts/${r.id}`, t("today.recent.lead"), null] as const)
                        : ([
                            CalendarCheckIcon,
                            `/${ws}/calendars/${r.calendarId}`,
                            t("today.recent.booking", { when: f.dateTime(r.startAt) }),
                            null,
                          ] as const);
                  return (
                    <li key={i}>
                      <Link href={href} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-navy/[0.06] text-brand-navy dark:bg-white/[0.08] dark:text-white">
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            <bdi>{r.who}</bdi> · {f.timeAgo(r.at)}
                          </span>
                        </span>
                        {value && (
                          <span className="font-medium tabular-nums" dir="ltr">
                            {value}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("today.top.title")}</CardTitle>
            <CardDescription>{t("today.top.hint")}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.topFunnels.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("today.top.empty")}</p>
            ) : (
              <ol className="space-y-4" data-testid="top-funnels">
                {data.topFunnels.map((fn) => (
                  <li key={fn.id}>
                    <Link href={`/${ws}/funnels/${fn.id}`} className="group block">
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span className="truncate font-medium group-hover:underline">{fn.name}</span>
                        <span className="font-medium tabular-nums" dir="ltr">
                          {f.money(fn.revenue, data.currency)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${Math.max(2, (fn.revenue / data.topFunnels[0]!.revenue) * 100)}%` }}
                          />
                        </div>
                        <span className="w-16 text-end text-xs text-muted-foreground">
                          {t("today.top.orders", { count: fn.orders })}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold">{t("today.next.title")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nextSteps(data).map((k) => {
            const body = (
              <>
                <div className="text-sm font-semibold">{t(`today.next.${k}.title`)}</div>
                <p className="mt-1 text-sm text-muted-foreground">{t(`today.next.${k}.text`)}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-orange-text">
                  {t(`today.next.${k}.cta`)} <ArrowRightIcon className="size-3.5 rtl:rotate-180" />
                </span>
              </>
            );
            const cls =
              "block h-full w-full rounded-xl border bg-card p-5 text-start transition-[border-color,box-shadow] hover:border-brand-orange/50 hover:shadow-md";
            return k === "goal" ? (
              <GoalDialog key={k} {...goalProps}>
                <button type="button" className={cls}>
                  {body}
                </button>
              </GoalDialog>
            ) : (
              <Link key={k} href={NEXT_HREF[k](ws)} className={cls}>
                {body}
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}

function GoalCard({
  data,
  t,
  f,
  goalProps,
  editable,
}: {
  data: TodayData;
  t: T;
  f: F;
  goalProps: React.ComponentProps<typeof GoalDialog> extends infer P ? Omit<P, "children"> : never;
  editable: boolean;
}) {
  const g = data.goal;
  const STATUS: Record<string, { icon: LucideIcon; cls: string }> = {
    met: { icon: PartyPopperIcon, cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    ahead: { icon: TrendingUpIcon, cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
    on_track: { icon: TrendingUpIcon, cls: "bg-sky-500/10 text-sky-700 dark:text-sky-400" },
    behind: { icon: TrendingDownIcon, cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  };
  return (
    <Card data-testid="goal-card">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{t("today.goal.title")}</CardTitle>
          {g && editable && (
            <GoalDialog
              {...goalProps}
              initialMonth={data.goals.some((x) => x.month === goalProps.currentMonth) ? goalProps.currentMonth : ""}
            >
              <Button variant="ghost" size="sm">
                {t("today.goal.edit")}
              </Button>
            </GoalDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!g ? (
          <div className="flex flex-col items-start gap-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange-text">
              <TargetIcon className="size-5" />
            </div>
            <p className="text-sm text-muted-foreground">{t("today.goal.empty")}</p>
            {editable && (
              <GoalDialog {...goalProps}>
                <Button>{t("today.goal.set")}</Button>
              </GoalDialog>
            )}
          </div>
        ) : (
          (() => {
            const s = STATUS[g.pace.status]!;
            const pct = Math.min(1, g.pace.progress);
            return (
              <div className="space-y-4">
                <div>
                  <div className="text-2xl font-semibold tracking-tight tabular-nums">
                    <span dir="ltr">{f.money(g.revenue, g.currency)}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {t("today.goal.of", { goal: iso(f.money(g.amount, g.currency)) })} · {f.percent(g.pace.progress, 0)}
                  </div>
                </div>
                <div
                  className="relative h-2.5 rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(pct * 100)}
                  aria-label={t("today.goal.title")}
                >
                  <div className="h-full rounded-full bg-brand-orange" style={{ width: `${pct * 100}%` }} />
                  <div
                    className="absolute -top-1 h-[18px] w-0.5 rounded-full bg-foreground/50"
                    style={{ insetInlineStart: `${Math.min(100, g.pace.elapsed * 100)}%` }}
                    title={t("today.goal.expected", { amount: iso(f.money(g.pace.expected, g.currency)) })}
                  />
                </div>
                <span
                  className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", s.cls)}
                  data-testid="goal-status"
                >
                  <s.icon className="size-3.5" aria-hidden />
                  {t(`today.goal.status.${g.pace.status as "met"}`)}
                </span>
                <dl className="space-y-1 text-sm text-muted-foreground">
                  <div>{t("today.goal.projected", { amount: iso(f.money(g.pace.projected, g.currency)) })}</div>
                  <div>{t("today.goal.expected", { amount: iso(f.money(g.pace.expected, g.currency)) })}</div>
                  {g.pace.neededPerDay > 0 && g.pace.status === "behind" && (
                    <div>{t("today.goal.needed", { amount: iso(f.money(g.pace.neededPerDay, g.currency)) })}</div>
                  )}
                </dl>
              </div>
            );
          })()
        )}
      </CardContent>
    </Card>
  );
}

/** Keeps a formatted amount in one left-to-right piece inside an Arabic sentence. */
const iso = (s: string) => `\u2066${s}\u2069`;

function attention(
  item: AttentionItem,
  ws: string,
  t: T,
  f: F,
): { icon: LucideIcon; href: string; text: string; severe?: boolean } {
  switch (item.kind) {
    case "failedPayments":
      return {
        icon: CreditCardIcon,
        href: `/${ws}/orders?status=failed`,
        text: t("today.attention.failedPayments", { count: item.count }),
        severe: true,
      };
    case "pastDue":
      return {
        icon: CreditCardIcon,
        href: `/${ws}/orders`,
        text: t("today.attention.pastDue", { count: item.count }),
        severe: true,
      };
    case "unanswered":
      return {
        icon: MessageCircleIcon,
        href: `/${ws}/inbox?c=${item.conversationId}`,
        text: t("today.attention.unanswered", { count: item.count, hours: UNANSWERED_HOURS }),
      };
    case "abandoned":
      return {
        icon: ShoppingCartIcon,
        href: `/${ws}/orders?status=pending`,
        text: t("today.attention.abandoned", { count: item.count }),
      };
    case "webinarEmpty":
      return {
        icon: VideoIcon,
        href: `/${ws}/webinars/${item.webinarId}`,
        text: t("today.attention.webinarEmpty", { title: item.title, when: f.timeAgo(item.startAt) }),
      };
    case "domainFailing":
      return {
        icon: GlobeIcon,
        href: `/${ws}/settings/domains`,
        text: t("today.attention.domainFailing", { hostname: item.hostname }),
        severe: true,
      };
    case "drafts":
      return {
        icon: FileClockIcon,
        href: `/${ws}/funnels/${item.funnelId}`,
        text: t("today.attention.drafts", { count: item.count, funnel: item.funnelName }),
      };
    case "stripe":
      return { icon: AlertTriangleIcon, href: `/${ws}/settings/payments`, text: t("today.attention.stripe") };
  }
}

type NextKey = "funnel" | "stripe" | "product" | "publish" | "traffic" | "domain" | "goal" | "analytics";
const NEXT_HREF: Record<Exclude<NextKey, "goal">, (ws: string) => string> = {
  funnel: (ws) => `/${ws}/funnels`,
  stripe: (ws) => `/${ws}/settings/payments`,
  product: (ws) => `/${ws}/products`,
  publish: (ws) => `/${ws}/funnels`,
  traffic: (ws) => `/${ws}/funnels`,
  domain: (ws) => `/${ws}/settings/domains`,
  analytics: (ws) => `/${ws}/analytics`,
};

/** Up to three suggestions, most important first, based on what the workspace has set up. */
function nextSteps(d: TodayData): NextKey[] {
  const s = d.state;
  const out: NextKey[] = [];
  if (s.funnels === 0) out.push("funnel");
  if (!s.stripe) out.push("stripe");
  if (s.products === 0) out.push("product");
  if (s.hasDrafts) out.push("publish");
  if (s.funnels > 0 && s.contacts === 0) out.push("traffic");
  if (!d.goal) out.push("goal");
  if (s.domains === 0) out.push("domain");
  out.push("analytics");
  return out.slice(0, 3);
}
