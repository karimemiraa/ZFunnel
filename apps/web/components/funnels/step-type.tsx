import { cn } from "@zfunnel/ui/lib/utils";
import type { StepType } from "@/lib/funnels";

export const STEP_COLORS: Record<StepType, string> = {
  optin: "#0ea5e9",
  sales: "#8b5cf6",
  checkout: "#10b981",
  upsell: "#f59e0b",
  downsell: "#f97316",
  thankyou: "#ec4899",
  page: "#64748b",
};

export const STEP_LABELS: Record<StepType, string> = {
  optin: "Opt-in",
  sales: "Sales page",
  checkout: "Checkout",
  upsell: "Upsell",
  downsell: "Downsell",
  thankyou: "Thank you",
  page: "Page",
};

export function StepTypeDot({ type, className }: { type: StepType; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: STEP_COLORS[type] }}
    />
  );
}

export function StepTypeBadge({ type }: { type: StepType }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: `${STEP_COLORS[type]}1f`, color: STEP_COLORS[type] }}
    >
      <StepTypeDot type={type} />
      {STEP_LABELS[type]}
    </span>
  );
}
