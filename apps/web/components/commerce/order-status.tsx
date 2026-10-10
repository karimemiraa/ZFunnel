"use client";

import { useT } from "@zfunnel/i18n/react";
import { Badge } from "@zfunnel/ui/badge";

const MAP = {
  paid: { variant: "success" },
  pending: { variant: "warning" },
  failed: { variant: "secondary" },
  refunded: { variant: "secondary" },
  partially_refunded: { variant: "warning" },
} as const;

export function OrderStatus({ status, test }: { status: keyof typeof MAP; test?: boolean }) {
  const t = useT();
  const key = status in MAP ? status : "pending";
  const m = MAP[key];
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={m.variant}>{t(`orders.status.${key}`)}</Badge>
      {test && <Badge variant="outline">{t("orders.test")}</Badge>}
    </span>
  );
}
