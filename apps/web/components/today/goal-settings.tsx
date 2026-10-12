import { Button } from "@zfunnel/ui/button";
import { revenueGoals } from "@zfunnel/db";
import { inWorkspace } from "@/lib/funnels";
import { intlLocale } from "@zfunnel/i18n";
import { getFmt, getLocale, getT } from "@/lib/i18n";
import { monthKey } from "@/lib/today-math";
import type { WorkspaceContext } from "@/lib/workspaces";
import { GoalDialog } from "./goal-dialog";

/** Settings → General: the workspace's revenue goals, each editable in the shared dialog. */
export async function GoalSettings({ ctx, editable }: { ctx: WorkspaceContext; editable: boolean }) {
  const [t, f, locale, rows] = await Promise.all([
    getT(),
    getFmt(),
    getLocale(),
    inWorkspace(ctx, (tx) => tx.select().from(revenueGoals).orderBy(revenueGoals.month)),
  ]);
  const goals = rows.map((g) => ({ month: g.month, amount: g.amount, currency: g.currency }));
  const props = {
    slug: ctx.workspace.slug,
    goals,
    currentMonth: monthKey(new Date()),
    defaultCurrency: goals[0]?.currency ?? "usd",
    disabled: !editable,
  };
  const monthName = (m: string) =>
    new Date(`${m}-01T00:00:00Z`).toLocaleDateString(intlLocale(locale), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  return (
    <div className="space-y-3">
      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("today.goal.none")}</p>
      ) : (
        <ul className="divide-y rounded-lg border text-sm" data-testid="goal-list">
          {goals.map((g) => (
            <li key={g.month} className="flex items-center justify-between gap-3 px-3 py-2">
              <span>{g.month ? monthName(g.month) : t("today.goal.defaultRow")}</span>
              <span className="flex items-center gap-2">
                <span className="font-medium tabular-nums" dir="ltr">
                  {f.money(g.amount, g.currency)}
                </span>
                {editable && (
                  <GoalDialog {...props} initialMonth={g.month}>
                    <Button variant="ghost" size="sm">
                      {t("today.goal.edit")}
                    </Button>
                  </GoalDialog>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <GoalDialog {...props}>
          <Button variant="outline">{t("today.goal.set")}</Button>
        </GoalDialog>
      )}
    </div>
  );
}
