import { Badge } from "@zfunnel/ui/badge";

const MAP = {
  paid: { label: "Paid", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  failed: { label: "Failed", variant: "secondary" },
  refunded: { label: "Refunded", variant: "secondary" },
  partially_refunded: { label: "Partly refunded", variant: "warning" },
} as const;

export function OrderStatus({ status, test }: { status: keyof typeof MAP; test?: boolean }) {
  const m = MAP[status] ?? MAP.pending;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={m.variant}>{m.label}</Badge>
      {test && <Badge variant="outline">Test</Badge>}
    </span>
  );
}
