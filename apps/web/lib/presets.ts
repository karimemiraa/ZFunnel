import { TEMPLATES, type FunnelTemplate } from "@zfunnel/blocks";
import type { T } from "@zfunnel/i18n";
import { FUNNEL_PRESETS, STEP_TYPE_META, type FunnelPreset } from "./funnels";

type TemplateId =
  | "quiz"
  | "lead-magnet"
  | "webinar"
  | "book"
  | "tripwire"
  | "product-launch"
  | "vsl"
  | "application"
  | "saas-trial"
  | "course"
  | "ecommerce";
const TEMPLATE_IDS: readonly string[] = [
  "quiz",
  "lead-magnet",
  "webinar",
  "book",
  "tripwire",
  "product-launch",
  "vsl",
  "application",
  "saas-trial",
  "course",
  "ecommerce",
] satisfies TemplateId[];
const known = (id: string): id is TemplateId => TEMPLATE_IDS.includes(id);

/** A step chip label: the localized step type when the name is the type's default label. */
function chipName(t: T, name: string, type: keyof typeof STEP_TYPE_META) {
  if (name === STEP_TYPE_META[type].label) return t(`funnels.stepTypes.${type}`);
  if (name === "Home") return t("funnels.home");
  return name;
}

/** Serializable preset list for client components, in the dashboard language. */
export function presetList(t: T) {
  return Object.entries(FUNNEL_PRESETS).map(([key, p]) => ({
    key,
    label: t(`funnels.presets.${key as FunnelPreset}`),
    description: p.description,
    steps: p.steps.map(([name, type]) => [chipName(t, name, type), type] as [string, typeof type]),
  }));
}

/** Template names, categories and descriptions shown in the "new funnel" picker, in the dashboard language. */
export function templateList(t: T) {
  return TEMPLATES.map((tpl: FunnelTemplate) => ({
    id: tpl.id,
    name: known(tpl.id) ? t(`templates.${tpl.id}.name`) : tpl.name,
    category: t(`templates.categories.${tpl.category}`),
    description: known(tpl.id) ? t(`templates.${tpl.id}.description`) : tpl.description,
    steps: tpl.steps.map((s) => [chipName(t, s.name, s.type), s.type] as [string, typeof s.type]),
  }));
}
