"use client";

import { formatMoney } from "@zfunnel/payments/money";
import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { NativeSelect } from "@zfunnel/ui/select";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon, PackageIcon, PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addStepOffer, removeStepOffer } from "@/lib/commerce-actions";

type Offer = {
  offerId: string;
  role: "main" | "bump" | "upsell" | "downsell";
  productName: string;
  amount: number;
  currency: string;
  type: string;
  interval: string | null;
  headline: string | null;
};
type ProductOption = { priceId: string; label: string };

const ROLE_LABEL = {
  main: "Main product",
  bump: "Order bump",
  upsell: "One-click upsell",
  downsell: "One-click downsell",
};
const ROLE_HELP = {
  main: "What buyers purchase on this checkout. Add several to let them choose.",
  bump: "A checkbox offer right above the pay button.",
  upsell: "Charged with one click using the card from checkout.",
  downsell: "A cheaper one-click alternative after a declined upsell.",
};

export function StepOffers({
  workspaceSlug,
  stepId,
  stepType,
  offers,
  products,
}: {
  workspaceSlug: string;
  stepId: string;
  stepType: string;
  offers: Offer[];
  products: ProductOption[];
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const roles: Offer["role"][] =
    stepType === "upsell" ? ["upsell"] : stepType === "downsell" ? ["downsell"] : ["main", "bump"];
  const [role, setRole] = useState<Offer["role"]>(roles[0]!);
  const [priceId, setPriceId] = useState(products[0]?.priceId ?? "");
  const [headline, setHeadline] = useState("");

  const add = () =>
    start(async () => {
      const r = await addStepOffer(workspaceSlug, stepId, { priceId, role, headline });
      if (!r.ok) return void toast.error(r.error);
      toast.success(`${ROLE_LABEL[role]} added`);
      setHeadline("");
      router.refresh();
    });

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Products on this step</h3>
          <p className="text-sm text-muted-foreground">{roles.map((r) => ROLE_HELP[r]).join(" ")}</p>
        </div>
      </div>

      {offers.length > 0 && (
        <ul className="mb-4 divide-y rounded-lg border">
          {offers.map((o) => (
            <li key={o.offerId} className="flex items-center gap-3 p-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <PackageIcon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{o.productName}</div>
                <div className="text-xs text-muted-foreground">
                  {ROLE_LABEL[o.role]} · {formatMoney(o.amount, o.currency)}
                  {o.type !== "one_time" ? `/${o.interval}` : ""}
                  {o.headline ? ` · “${o.headline}”` : ""}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${o.productName}`}
                disabled={busy}
                onClick={() =>
                  start(async () => {
                    await removeStepOffer(workspaceSlug, o.offerId);
                    toast.success("Removed");
                    router.refresh();
                  })
                }
              >
                <Trash2Icon />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You don&apos;t have any products yet.{" "}
          <Link href={`/${workspaceSlug}/products`} className="font-medium text-primary hover:underline">
            Create a product →
          </Link>
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="offer-price">Product</Label>
            <NativeSelect id="offer-price" value={priceId} onChange={(e) => setPriceId(e.target.value)}>
              {products.map((p) => (
                <option key={p.priceId} value={p.priceId}>
                  {p.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          {roles.length > 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="offer-role">As</Label>
              <NativeSelect id="offer-role" value={role} onChange={(e) => setRole(e.target.value as Offer["role"])}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <Button onClick={add} disabled={busy || !priceId}>
            {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} Add
          </Button>
          {role === "bump" && (
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="offer-headline">Bump headline</Label>
              <Input
                id="offer-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Yes! Add the done-for-you templates"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
