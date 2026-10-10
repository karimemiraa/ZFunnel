import { FUNNEL_PRESETS } from "./funnels";

/** Serializable preset list for client components. */
export function presetList() {
  return Object.entries(FUNNEL_PRESETS).map(([key, p]) => ({
    key,
    label: p.label,
    description: p.description,
    steps: p.steps,
  }));
}
