"use client";

import { useT } from "@zfunnel/i18n/react";
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
import { useFmt } from "@/lib/use-fmt";

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

const roleKey = (role: Offer["role"]) => `funnels.offers.roles.${role}` as const;
const helpKey = (role: Offer["role"]) => `funnels.offers.help.${role}` as const;

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
  const t = useT();
  const f = useFmt();
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
      toast.success(t("funnels.offers.added", { role: t(roleKey(role)) }));
      setHeadline("");
      router.refresh();
    });

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{t("funnels.offers.title")}</h3>
          <p className="text-sm text-muted-foreground">{roles.map((r) => t(helpKey(r))).join(" ")}</p>
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
                  {t(roleKey(o.role))} · {f.money(o.amount, o.currency)}
                  {o.type !== "one_time" ? `/${o.interval}` : ""}
                  {o.headline ? ` · “${o.headline}”` : ""}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("funnels.offers.remove", { name: o.productName })}
                disabled={busy}
                onClick={() =>
                  start(async () => {
                    await removeStepOffer(workspaceSlug, o.offerId);
                    toast.success(t("funnels.offers.removed"));
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
          {t("funnels.offers.noProducts")}{" "}
          <Link href={`/${workspaceSlug}/products`} className="font-medium text-primary hover:underline">
            {t("funnels.offers.createProduct")}
          </Link>
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="offer-price">{t("funnels.offers.product")}</Label>
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
              <Label htmlFor="offer-role">{t("funnels.offers.as")}</Label>
              <NativeSelect id="offer-role" value={role} onChange={(e) => setRole(e.target.value as Offer["role"])}>
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {t(roleKey(r))}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
          <Button onClick={add} disabled={busy || !priceId}>
            {busy ? <Loader2Icon className="animate-spin" /> : <PlusIcon />} {t("funnels.offers.add")}
          </Button>
          {role === "bump" && (
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="offer-headline">{t("funnels.offers.bumpHeadline")}</Label>
              <Input
                id="offer-headline"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder={t("funnels.offers.bumpPlaceholder")}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
