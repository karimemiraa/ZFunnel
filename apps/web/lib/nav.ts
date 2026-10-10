import {
  BarChart3Icon,
  BookOpenIcon,
  CalendarIcon,
  ContactIcon,
  type LucideIcon,
  LayoutDashboardIcon,
  MailIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  WorkflowIcon,
  FilterIcon,
} from "lucide-react";

export type NavModule = {
  /** URL segment under /[workspace]. Empty string = overview. */
  segment: string;
  label: string;
  icon: LucideIcon;
  /** Roadmap phase that ships it; undefined = available now. */
  phase?: number;
  description: string;
};

export const NAV_MODULES: NavModule[] = [
  { segment: "", label: "Overview", icon: LayoutDashboardIcon, description: "Your workspace at a glance." },
  {
    segment: "funnels",
    label: "Funnels",
    icon: FilterIcon,
    description: "Build opt-in, sales, checkout and upsell funnels with the drag-and-drop editor.",
  },
  {
    segment: "products",
    label: "Products",
    icon: PackageIcon,
    description: "Sell one-time offers, subscriptions and payment plans with order bumps and one-click upsells.",
  },
  {
    segment: "orders",
    label: "Orders",
    icon: ReceiptIcon,
    description: "Track purchases, refunds and subscriptions.",
  },
  {
    segment: "analytics",
    label: "Analytics",
    icon: BarChart3Icon,
    description: "Visits, opt-ins, sales and revenue for every funnel step.",
  },
  {
    segment: "contacts",
    label: "Contacts",
    icon: ContactIcon,
    description: "Your CRM: contacts, tags, segments and pipelines.",
  },
  {
    segment: "email",
    label: "Email",
    icon: MailIcon,
    phase: 2,
    description: "Broadcasts, sequences and a drag-and-drop email editor.",
  },
  {
    segment: "automations",
    label: "Automations",
    icon: WorkflowIcon,
    phase: 2,
    description: "Visual workflows: triggers, waits, branches and actions.",
  },
  {
    segment: "courses",
    label: "Courses",
    icon: BookOpenIcon,
    phase: 3,
    description: "Courses and memberships with drip content, quizzes and certificates.",
  },
  {
    segment: "calendars",
    label: "Calendars",
    icon: CalendarIcon,
    phase: 3,
    description: "Booking pages with availability and calendar sync.",
  },
];

export const SETTINGS_MODULE: NavModule = {
  segment: "settings",
  label: "Settings",
  icon: SettingsIcon,
  description: "Workspace, team and activity.",
};
