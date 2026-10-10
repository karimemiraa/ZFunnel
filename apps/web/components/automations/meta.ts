import type { WorkflowNode, WorkflowTrigger } from "@zfunnel/db/schema";
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
  TagIcon,
  TagsIcon,
  WebhookIcon,
  ClipboardListIcon,
} from "lucide-react";

export const NODE_META: Record<WorkflowNode["type"], { label: string; icon: LucideIcon; color: string; hint: string }> =
  {
    send_email: { label: "Send email", icon: MailIcon, color: "#6366f1", hint: "Email the contact" },
    wait: { label: "Wait", icon: ClockIcon, color: "#f59e0b", hint: "Pause before the next step" },
    add_tag: { label: "Add tag", icon: TagIcon, color: "#10b981", hint: "Tag the contact" },
    remove_tag: { label: "Remove tag", icon: TagsIcon, color: "#f43f5e", hint: "Remove a tag" },
    condition: { label: "If / else", icon: GitBranchIcon, color: "#0ea5e9", hint: "Branch on a condition" },
    webhook: { label: "Webhook", icon: WebhookIcon, color: "#64748b", hint: "POST the contact to a URL" },
    grant_course: {
      label: "Give course access",
      icon: GraduationCapIcon,
      color: "#8b5cf6",
      hint: "Enroll the contact in a course",
    },
  };
export const NODE_ORDER: WorkflowNode["type"][] = [
  "send_email",
  "wait",
  "condition",
  "add_tag",
  "remove_tag",
  "webhook",
];

export const TRIGGER_META: Record<WorkflowTrigger["type"], { label: string; icon: LucideIcon; hint: string }> = {
  optin: { label: "Opts in to a funnel", icon: FilterIcon, hint: "Someone submits an opt-in form" },
  purchase: { label: "Makes a purchase", icon: CreditCardIcon, hint: "Checkout or one-click upsell succeeds" },
  tag_added: { label: "Tag is added", icon: TagIcon, hint: "A tag is added to a contact" },
  form_submitted: { label: "Submits a form", icon: ClipboardListIcon, hint: "A survey or form is submitted" },
  booked: {
    label: "Books an appointment",
    icon: CalendarCheckIcon,
    hint: "A booking is made on one of your calendars",
  },
  manual: { label: "Added manually", icon: HandIcon, hint: "You add contacts yourself" },
};
export const TRIGGER_CHOICES: WorkflowTrigger["type"][] = [
  "optin",
  "form_submitted",
  "purchase",
  "tag_added",
  "manual",
];

export type Lookups = {
  funnels: { id: string; name: string }[];
  products: { id: string; name: string }[];
  tags: string[];
  emails: { id: string; name: string; subject: string; preheader: string }[];
  courses: { id: string; title: string }[];
  calendars: { id: string; name: string }[];
};

export function triggerSummary(t: WorkflowTrigger, l: Pick<Lookups, "funnels" | "products" | "calendars">) {
  switch (t.type) {
    case "optin":
    case "form_submitted":
      return t.funnelId ? (l.funnels.find((f) => f.id === t.funnelId)?.name ?? "A deleted funnel") : "Any funnel";
    case "purchase":
      return t.productId ? (l.products.find((p) => p.id === t.productId)?.name ?? "A deleted product") : "Any product";
    case "booked":
      return t.calendarId
        ? (l.calendars.find((c) => c.id === t.calendarId)?.name ?? "A deleted calendar")
        : "Any calendar";
    case "tag_added":
      return t.tag ? `“${t.tag}”` : "Choose a tag";
    case "manual":
      return "From a contact's profile";
  }
}

export function nodeSummary(n: WorkflowNode, l: Pick<Lookups, "emails" | "courses">) {
  switch (n.type) {
    case "send_email": {
      const e = l.emails.find((x) => x.id === n.emailId);
      return e ? e.subject || e.name : "Choose an email";
    }
    case "wait":
      return `${n.amount} ${n.amount === 1 ? n.unit.slice(0, -1) : n.unit}`;
    case "add_tag":
    case "remove_tag":
      return n.tag ? `“${n.tag}”` : "Choose a tag";
    case "condition": {
      const r = n.rule;
      if (!r) return "Set a condition";
      if (r.field === "tag") return `${r.op === "has" ? "Has" : "Doesn't have"} tag “${r.value}”`;
      if (r.field === "customer") return r.op === "is" ? "Is a customer" : "Is not a customer";
      if (r.field === "email" || r.field === "name")
        return `${r.field === "email" ? "Email" : "Name"} contains “${r.value}”`;
      if (r.field === "custom") return `${r.key} ${r.op === "is_set" ? "is set" : `${r.op} “${r.value ?? ""}”`}`;
      return "Custom condition";
    }
    case "grant_course":
      return n.courseId ? (l.courses.find((c) => c.id === n.courseId)?.title ?? "A deleted course") : "Choose a course";
    case "webhook":
      return n.url ? n.url.replace(/^https?:\/\//, "").slice(0, 40) : "Set a URL";
  }
}
