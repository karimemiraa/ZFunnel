import { TEMPLATES } from "@zfunnel/blocks";
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

export function templateList() {
  return TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    description: t.description,
    steps: t.steps.map((s) => [s.name, s.type] as [string, typeof s.type]),
  }));
}
