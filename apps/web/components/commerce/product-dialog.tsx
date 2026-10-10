"use client";

import { Button } from "@zfunnel/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@zfunnel/ui/dialog";
import { FormMessage } from "@zfunnel/ui/form-message";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { cn } from "@zfunnel/ui/lib/utils";
import { NativeSelect } from "@zfunnel/ui/select";
import { Textarea } from "@zfunnel/ui/textarea";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon } from "lucide-react";
import { useT } from "@zfunnel/i18n/react";
import { startTransition, useActionState, useState } from "react";
import { saveProduct, type FormState } from "@/lib/commerce-actions";
import { CURRENCIES, minorUnits } from "@zfunnel/shared";

/** Minor units → the editable major amount ("97", "47.50", "4700" for JPY). */
const amountInput = (amount: number, currency: string) => {
  const f = 10 ** minorUnits(currency);
  return (amount / f).toFixed(amount % f ? minorUnits(currency) : 0);
};

type Initial = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  inStore?: boolean;
  stock?: number | null;
  requiresShipping?: boolean;
  price?: {
    label: string | null;
    type: "one_time" | "recurring" | "payment_plan";
    amount: number;
    currency: string;
    interval: string | null;
    trialDays: number | null;
    installments: number | null;
  };
};

const TYPES = [{ value: "one_time" }, { value: "recurring" }, { value: "payment_plan" }] as const;

export function ProductDialog({
  workspaceSlug,
  initial,
  trigger,
}: {
  workspaceSlug: string;
  initial?: Initial;
  trigger: React.ReactNode;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>(initial?.price?.type ?? "one_time");
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await saveProduct(workspaceSlug, initial?.id ?? null, prev, fd);
    if (r?.success) {
      toast.success(r.success);
      setOpen(false);
    }
    return r;
  }, null);
  const err = (k: string) => state?.fieldErrors?.[k]?.[0];
  const p = initial?.price;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? t("products.editProduct") : t("products.newProduct")}</DialogTitle>
          <DialogDescription>{t("products.dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form
          // Not `action={action}`: React would reset every field after a validation error.
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(() => action(fd));
          }}
          className="grid gap-4"
        >
          <div className="space-y-2">
            <Label htmlFor="p-name">{t("products.name")}</Label>
            <Input
              id="p-name"
              name="name"
              defaultValue={initial?.name}
              placeholder={t("products.namePlaceholder")}
              required
            />
            <FormMessage message={err("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">{t("products.shortDescription")}</Label>
            <Textarea
              id="p-desc"
              name="description"
              defaultValue={initial?.description ?? ""}
              rows={2}
              placeholder={t("products.shortDescriptionPlaceholder")}
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">{t("products.pricing")}</legend>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((ty) => (
                <label
                  key={ty.value}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-colors",
                    type === ty.value
                      ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                      : "hover:border-foreground/20",
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    value={ty.value}
                    checked={type === ty.value}
                    onChange={() => setType(ty.value)}
                    className="sr-only"
                  />
                  <span className="font-medium">{t(`products.types.${ty.value}`)}</span>
                  <span className="text-xs text-muted-foreground">{t(`products.typeHints.${ty.value}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-amount">
                {type === "payment_plan" ? t("products.amountPerPayment") : t("products.price")}
              </Label>
              <Input
                id="p-amount"
                name="amount"
                inputMode="decimal"
                defaultValue={p ? amountInput(p.amount, p.currency) : ""}
                placeholder="97"
                required
              />
              <FormMessage message={err("amount")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-currency">{t("products.currency")}</Label>
              <NativeSelect id="p-currency" name="currency" defaultValue={p?.currency ?? "usd"}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          {type !== "one_time" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="p-interval">{t("products.billingEvery")}</Label>
                <NativeSelect id="p-interval" name="interval" defaultValue={p?.interval ?? "month"}>
                  <option value="month">{t("products.intervalOptions.month")}</option>
                  <option value="year">{t("products.intervalOptions.year")}</option>
                </NativeSelect>
              </div>
              {type === "recurring" ? (
                <div className="space-y-2">
                  <Label htmlFor="p-trial">{t("products.freeTrialDays")}</Label>
                  <Input
                    id="p-trial"
                    name="trialDays"
                    type="number"
                    min={0}
                    max={365}
                    defaultValue={p?.trialDays ?? ""}
                    placeholder="0"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="p-inst">{t("products.numberOfPayments")}</Label>
                  <Input
                    id="p-inst"
                    name="installments"
                    type="number"
                    min={2}
                    max={36}
                    defaultValue={p?.installments ?? 3}
                  />
                  <FormMessage message={err("installments")} />
                </div>
              )}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="p-label">{t("products.priceLabel")}</Label>
            <Input
              id="p-label"
              name="priceLabel"
              defaultValue={p?.label ?? ""}
              placeholder={t("products.priceLabelPlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-image">{t("products.imageUrl")}</Label>
            <Input
              id="p-image"
              name="imageUrl"
              dir="ltr"
              defaultValue={initial?.imageUrl ?? ""}
              placeholder="https://…"
            />
            <FormMessage message={err("imageUrl")} />
          </div>
          <fieldset className="grid gap-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">{t("products.store")}</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="inStore" className="size-4" defaultChecked={initial?.inStore ?? false} />{" "}
              {t("products.sellInStore")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="requiresShipping"
                className="size-4"
                defaultChecked={initial?.requiresShipping ?? false}
              />{" "}
              {t("products.physical")}
            </label>
            <div className="space-y-1">
              <Label htmlFor="p-stock">{t("products.stock")}</Label>
              <Input
                id="p-stock"
                name="stock"
                type="number"
                min={0}
                defaultValue={initial?.stock ?? ""}
                className="w-40"
              />
            </div>
          </fieldset>
          <FormMessage message={state?.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("products.cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {initial ? t("products.save") : t("products.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
