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
import { useActionState, useState } from "react";
import { saveProduct, type FormState } from "@/lib/commerce-actions";

type Initial = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
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

const TYPES = [
  { value: "one_time", label: "One-time", hint: "Pay once" },
  { value: "recurring", label: "Subscription", hint: "Monthly or yearly" },
  { value: "payment_plan", label: "Payment plan", hint: "Split into installments" },
] as const;

const CURRENCIES = ["usd", "eur", "gbp", "cad", "aud", "chf", "sar", "aed"];

export function ProductDialog({
  workspaceSlug,
  initial,
  trigger,
}: {
  workspaceSlug: string;
  initial?: Initial;
  trigger: React.ReactNode;
}) {
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
          <DialogTitle>{initial ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Products can be sold on any checkout, as an order bump, or as a one-click upsell.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              name="name"
              defaultValue={initial?.name}
              placeholder="Masterclass: Lifetime access"
              required
            />
            <FormMessage message={err("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">Short description</Label>
            <Textarea
              id="p-desc"
              name="description"
              defaultValue={initial?.description ?? ""}
              rows={2}
              placeholder="Shown on the order form"
            />
          </div>
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Pricing</legend>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <label
                  key={t.value}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-colors",
                    type === t.value
                      ? "border-primary bg-primary/5 ring-2 ring-primary/15"
                      : "hover:border-foreground/20",
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => setType(t.value)}
                    className="sr-only"
                  />
                  <span className="font-medium">{t.label}</span>
                  <span className="text-xs text-muted-foreground">{t.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-amount">{type === "payment_plan" ? "Amount per payment" : "Price"}</Label>
              <Input
                id="p-amount"
                name="amount"
                inputMode="decimal"
                defaultValue={p ? (p.amount / 100).toFixed(p.amount % 100 ? 2 : 0) : ""}
                placeholder="97"
                required
              />
              <FormMessage message={err("amount")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-currency">Currency</Label>
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
                <Label htmlFor="p-interval">Billing every</Label>
                <NativeSelect id="p-interval" name="interval" defaultValue={p?.interval ?? "month"}>
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </NativeSelect>
              </div>
              {type === "recurring" ? (
                <div className="space-y-2">
                  <Label htmlFor="p-trial">Free trial (days)</Label>
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
                  <Label htmlFor="p-inst">Number of payments</Label>
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
            <Label htmlFor="p-label">Price label (optional)</Label>
            <Input id="p-label" name="priceLabel" defaultValue={p?.label ?? ""} placeholder="e.g. Lifetime access" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-image">Image URL (optional)</Label>
            <Input id="p-image" name="imageUrl" defaultValue={initial?.imageUrl ?? ""} placeholder="https://…" />
            <FormMessage message={err("imageUrl")} />
          </div>
          <FormMessage message={state?.error} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              {initial ? "Save product" : "Create product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
