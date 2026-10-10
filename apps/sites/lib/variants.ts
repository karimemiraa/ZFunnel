/** Split-test assignment. A visitor keeps the variant they first saw (cookie set by the tracker). */
export const variantCookie = (stepId: string) => `zfv_${stepId.replace(/-/g, "").slice(0, 16)}`;

/**
 * Returns the variant id to show (null = original page A) and whether this is a new assignment.
 * Weights are percentages of traffic for each challenger; whatever is left goes to A.
 */
export function pickVariant(
  variants: { id: string; weight: number }[],
  cookie: string | undefined,
  roll = Math.random(),
) {
  if (!variants.length) return { id: null, fresh: false };
  if (cookie === "a") return { id: null, fresh: false };
  if (cookie && variants.some((v) => v.id === cookie)) return { id: cookie, fresh: false };
  let acc = 0;
  const r = roll * 100;
  for (const v of variants) {
    acc += Math.max(0, Math.min(100, v.weight));
    if (r < acc) return { id: v.id, fresh: true };
  }
  return { id: null, fresh: true };
}
