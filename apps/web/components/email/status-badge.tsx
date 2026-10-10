import { Badge } from "@zfunnel/ui/badge";

const MAP = {
  draft: { label: "Draft", variant: "secondary" },
  scheduled: { label: "Scheduled", variant: "default" },
  sending: { label: "Sending", variant: "outline" },
  sent: { label: "Sent", variant: "success" },
  failed: { label: "Failed", variant: "warning" },
} as const;

export function BroadcastStatusBadge({ status }: { status: keyof typeof MAP }) {
  const m = MAP[status] ?? MAP.draft;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}
