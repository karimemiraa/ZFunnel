import type { WorkflowNode, WorkflowTrigger } from "@zfunnel/db/schema";
import type { MessageKey, T } from "@zfunnel/i18n";
import {
  CalendarCheckIcon,
  ClockIcon,
  GraduationCapIcon,
  CreditCardIcon,
  FilterIcon,
  GitBranchIcon,
  HandIcon,
  type LucideIcon,
  MailIcon,
  MessageSquareIcon,
  TagIcon,
  TagsIcon,
  WebhookIcon,
  ClipboardListIcon,
  MonitorPlayIcon,
  PresentationIcon,
} from "lucide-react";

/** Labels and hints are i18n keys (`automations.nodes.<type>`); translate them where rendered. */
export const NODE_META: Record<
  WorkflowNode["type"],
  { label: MessageKey; icon: LucideIcon; color: string; hint: MessageKey }
> = {
  send_email: {
    label: "automations.nodes.send_email.label",
    icon: MailIcon,
    color: "#6366f1",
    hint: "automations.nodes.send_email.hint",
  },
  wait: {
    label: "automations.nodes.wait.label",
    icon: ClockIcon,
    color: "#f59e0b",
    hint: "automations.nodes.wait.hint",
  },
  add_tag: {
    label: "automations.nodes.add_tag.label",
    icon: TagIcon,
    color: "#10b981",
    hint: "automations.nodes.add_tag.hint",
  },
  remove_tag: {
    label: "automations.nodes.remove_tag.label",
    icon: TagsIcon,
    color: "#f43f5e",
    hint: "automations.nodes.remove_tag.hint",
  },
  condition: {
    label: "automations.nodes.condition.label",
    icon: GitBranchIcon,
    color: "#0ea5e9",
    hint: "automations.nodes.condition.hint",
  },
  webhook: {
    label: "automations.nodes.webhook.label",
    icon: WebhookIcon,
    color: "#64748b",
    hint: "automations.nodes.webhook.hint",
  },
  send_sms: {
    label: "automations.nodes.send_sms.label",
    icon: MessageSquareIcon,
    color: "#ec4899",
    hint: "automations.nodes.send_sms.hint",
  },
  grant_course: {
    label: "automations.nodes.grant_course.label",
    icon: GraduationCapIcon,
    color: "#8b5cf6",
    hint: "automations.nodes.grant_course.hint",
  },
};
export const NODE_ORDER = [
  "send_email",
  "send_sms",
  "wait",
  "condition",
  "add_tag",
  "remove_tag",
  "grant_course",
  "webhook",
] as const satisfies readonly WorkflowNode["type"][];
// Compile-time guard: every step type must appear in the "Add a step" menu.
type MissingNode = Exclude<WorkflowNode["type"], (typeof NODE_ORDER)[number]>;
export const allNodesListed: [MissingNode] extends [never] ? true : MissingNode = true;

export const TRIGGER_META: Record<WorkflowTrigger["type"], { label: MessageKey; icon: LucideIcon; hint: MessageKey }> =
  {
    optin: { label: "automations.triggers.optin.label", icon: FilterIcon, hint: "automations.triggers.optin.hint" },
    purchase: {
      label: "automations.triggers.purchase.label",
      icon: CreditCardIcon,
      hint: "automations.triggers.purchase.hint",
    },
    tag_added: {
      label: "automations.triggers.tag_added.label",
      icon: TagIcon,
      hint: "automations.triggers.tag_added.hint",
    },
    form_submitted: {
      label: "automations.triggers.form_submitted.label",
      icon: ClipboardListIcon,
      hint: "automations.triggers.form_submitted.hint",
    },
    booked: {
      label: "automations.triggers.booked.label",
      icon: CalendarCheckIcon,
      hint: "automations.triggers.booked.hint",
    },
    webinar_registered: {
      label: "automations.triggers.webinar_registered.label",
      icon: PresentationIcon,
      hint: "automations.triggers.webinar_registered.hint",
    },
    webinar_attended: {
      label: "automations.triggers.webinar_attended.label",
      icon: MonitorPlayIcon,
      hint: "automations.triggers.webinar_attended.hint",
    },
    manual: { label: "automations.triggers.manual.label", icon: HandIcon, hint: "automations.triggers.manual.hint" },
  };
export const TRIGGER_CHOICES = [
  "optin",
  "form_submitted",
  "purchase",
  "booked",
  "webinar_registered",
  "webinar_attended",
  "tag_added",
  "manual",
] as const satisfies readonly WorkflowTrigger["type"][];
type MissingTrigger = Exclude<WorkflowTrigger["type"], (typeof TRIGGER_CHOICES)[number]>;
export const allTriggersListed: [MissingTrigger] extends [never] ? true : MissingTrigger = true;

export type Lookups = {
  funnels: { id: string; name: string }[];
  products: { id: string; name: string }[];
  tags: string[];
  emails: { id: string; name: string; subject: string; preheader: string }[];
  courses: { id: string; title: string }[];
  calendars: { id: string; name: string }[];
  webinars: { id: string; title: string }[];
};

/** Human summary of a trigger; `missing` flags a trigger that still needs setting up. */
export function triggerSummary(
  tr: WorkflowTrigger,
  l: Pick<Lookups, "funnels" | "products" | "calendars" | "webinars">,
  t: T,
): { text: string; missing?: boolean } {
  switch (tr.type) {
    case "optin":
    case "form_submitted":
      return {
        text: tr.funnelId
          ? (l.funnels.find((f) => f.id === tr.funnelId)?.name ?? t("automations.summary.deletedFunnel"))
          : t("automations.summary.anyFunnel"),
      };
    case "purchase":
      return {
        text: tr.productId
          ? (l.products.find((p) => p.id === tr.productId)?.name ?? t("automations.summary.deletedProduct"))
          : t("automations.summary.anyProduct"),
      };
    case "booked":
      return {
        text: tr.calendarId
          ? (l.calendars.find((c) => c.id === tr.calendarId)?.name ?? t("automations.summary.deletedCalendar"))
          : t("automations.summary.anyCalendar"),
      };
    case "webinar_registered":
    case "webinar_attended":
      return {
        text: tr.webinarId
          ? (l.webinars.find((w) => w.id === tr.webinarId)?.title ?? t("automations.summary.deletedWebinar"))
          : t("automations.summary.anyWebinar"),
      };
    case "tag_added":
      return tr.tag
        ? { text: t("automations.summary.quoted", { value: tr.tag }) }
        : { text: t("automations.summary.chooseTag"), missing: true };
    case "manual":
      return { text: t("automations.summary.fromProfile") };
  }
}

/** Human summary of a step; `missing` flags a step that still needs setting up. */
export function nodeSummary(
  n: WorkflowNode,
  l: Pick<Lookups, "emails" | "courses">,
  t: T,
): { text: string; missing?: boolean } {
  switch (n.type) {
    case "send_email": {
      const e = l.emails.find((x) => x.id === n.emailId);
      return e ? { text: e.subject || e.name } : { text: t("automations.summary.chooseEmail"), missing: true };
    }
    case "wait":
      return { text: t(`automations.summary.${n.unit}`, { count: n.amount }) };
    case "add_tag":
    case "remove_tag":
      return n.tag
        ? { text: t("automations.summary.quoted", { value: n.tag }) }
        : { text: t("automations.summary.chooseTag"), missing: true };
    case "condition": {
      const r = n.rule;
      if (!r) return { text: t("automations.summary.setCondition"), missing: true };
      if (r.field === "tag")
        return {
          text: t(r.op === "has" ? "automations.summary.hasTag" : "automations.summary.notHasTag", {
            value: String(r.value),
          }),
        };
      if (r.field === "customer")
        return { text: t(r.op === "is" ? "automations.summary.isCustomer" : "automations.summary.notCustomer") };
      if (r.field === "email" || r.field === "name")
        return {
          text: t(r.field === "email" ? "automations.summary.emailContains" : "automations.summary.nameContains", {
            value: String(r.value),
          }),
        };
      if (r.field === "custom")
        return {
          text:
            r.op === "is_set"
              ? t("automations.summary.customIsSet", { key: r.key })
              : t("automations.summary.customOp", { key: r.key, op: r.op, value: String(r.value ?? "") }),
        };
      return { text: t("automations.summary.customCondition") };
    }
    case "send_sms":
      return n.message.trim() ? { text: n.message.slice(0, 40) } : { text: t("automations.summary.writeMessage") };
    case "grant_course":
      return n.courseId
        ? { text: l.courses.find((c) => c.id === n.courseId)?.title ?? t("automations.summary.deletedCourse") }
        : { text: t("automations.summary.chooseCourse"), missing: true };
    case "webhook":
      return n.url
        ? { text: n.url.replace(/^https?:\/\//, "").slice(0, 40) }
        : { text: t("automations.summary.setUrl"), missing: true };
  }
}
