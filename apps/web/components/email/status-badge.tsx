"use client";

import { useT } from "@zfunnel/i18n/react";
import { Badge } from "@zfunnel/ui/badge";

const MAP = {
  draft: { label: "email.status.draft", variant: "secondary" },
  scheduled: { label: "email.status.scheduled", variant: "default" },
  sending: { label: "email.status.sending", variant: "outline" },
  sent: { label: "email.status.sent", variant: "success" },
  failed: { label: "email.status.failed", variant: "warning" },
} as const;

export function BroadcastStatusBadge({ status }: { status: keyof typeof MAP }) {
  const t = useT();
  const m = MAP[status] ?? MAP.draft;
  return <Badge variant={m.variant}>{t(m.label)}</Badge>;
}
