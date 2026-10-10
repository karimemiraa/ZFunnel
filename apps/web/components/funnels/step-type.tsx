import { useT } from "@zfunnel/i18n/react";
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

export const STEP_TYPES: StepType[] = ["optin", "sales", "checkout", "upsell", "downsell", "thankyou", "page"];

/** Dictionary key for a step type's label: `t(stepLabelKey("optin"))`. */
export const stepLabelKey = (type: StepType) => `funnels.stepTypes.${type}` as const;

export function StepTypeDot({ type, className }: { type: StepType; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ background: STEP_COLORS[type] }}
    />
  );
}

/** Client-only (uses the i18n context). */
export function StepTypeBadge({ type }: { type: StepType }) {
  const t = useT();
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: `${STEP_COLORS[type]}1f`, color: STEP_COLORS[type] }}
    >
      <StepTypeDot type={type} />
      {t(stepLabelKey(type))}
    </span>
  );
}
