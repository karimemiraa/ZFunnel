"use client";

import { useT } from "@zfunnel/i18n/react";
import { CURRENCIES, minorUnits } from "@zfunnel/shared";
import { Button } from "@zfunnel/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@zfunnel/ui/dialog";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { cn } from "@zfunnel/ui/lib/utils";
import { NativeSelect } from "@zfunnel/ui/select";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteRevenueGoal, saveRevenueGoal } from "@/lib/goal-actions";

export type GoalRow = { month: string; amount: number; currency: string };

const toInput = (amount: number, currency: string) => {
  const f = 10 ** minorUnits(currency);
  return (amount / f).toFixed(amount % f ? minorUnits(currency) : 0);
};

/** Create, change or remove a monthly revenue goal (every month, or one month). */
export function GoalDialog({
  slug,
  goals,
  currentMonth,
  defaultCurrency,
  initialMonth = "",
  disabled,
  children,
}: {
  slug: string;
  goals: GoalRow[];
  currentMonth: string;
  defaultCurrency: string;
  /** "" edits the every-month goal; "YYYY-MM" edits that month. */
  initialMonth?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"every" | "one">(initialMonth ? "one" : "every");
  const [month, setMonth] = useState(initialMonth || currentMonth);
  const key = scope === "every" ? "" : month;
  const existing = goals.find((g) => g.month === key);
  const [currency, setCurrency] = useState(existing?.currency ?? defaultCurrency);
  const [amount, setAmount] = useState(existing ? toInput(existing.amount, existing.currency) : "");
  const [busy, start] = useTransition();

  const load = (k: string) => {
    const g = goals.find((x) => x.month === k);
    if (g) {
      setCurrency(g.currency);
      setAmount(toInput(g.amount, g.currency));
    }
  };

  const done = (msg: string) => {
    toast.success(msg);
    setOpen(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild disabled={disabled}>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("today.goal.dialogTitle")}</DialogTitle>
          <DialogDescription>{t("today.goal.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await saveRevenueGoal(slug, { amount, currency, month: key });
              if (!r.ok) return void toast.error(r.error);
              done(t("today.goal.saved"));
            });
          }}
        >
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{t("today.goal.appliesTo")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(["every", "one"] as const).map((s) => (
                <label
                  key={s}
                  className={cn(
                    "flex cursor-pointer items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    scope === s ? "border-primary bg-primary/5 ring-2 ring-primary/15" : "hover:border-foreground/20",
                  )}
                >
                  <input
                    type="radio"
                    name="scope"
                    className="sr-only"
                    checked={scope === s}
                    onChange={() => {
                      setScope(s);
                      load(s === "every" ? "" : month);
                    }}
                  />
                  {s === "every" ? t("today.goal.everyMonth") : t("today.goal.oneMonth")}
                </label>
              ))}
            </div>
          </fieldset>
          {scope === "one" && (
            <div className="space-y-2">
              <Label htmlFor="goal-month">{t("today.goal.month")}</Label>
              <Input
                id="goal-month"
                type="month"
                dir="ltr"
                value={month}
                required
                onChange={(e) => {
                  setMonth(e.target.value);
                  load(e.target.value);
                }}
              />
            </div>
          )}
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="goal-amount">{t("today.goal.amount")}</Label>
              <Input
                id="goal-amount"
                inputMode="decimal"
                dir="ltr"
                placeholder="10,000"
                value={amount}
                required
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="goal-currency">{t("today.goal.currency")}</Label>
              <NativeSelect id="goal-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2">
            {existing ? (
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                className="text-destructive hover:text-destructive"
                onClick={() =>
                  start(async () => {
                    const r = await deleteRevenueGoal(slug, key);
                    if (!r.ok) return void toast.error(r.error);
                    done(t("today.goal.removed"));
                  })
                }
              >
                {t("today.goal.remove")}
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" />} {t("today.goal.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
