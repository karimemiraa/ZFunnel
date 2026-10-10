import {
  BarChart3Icon,
  BookOpenIcon,
  CalendarIcon,
  ClipboardListIcon,
  ContactIcon,
  type LucideIcon,
  KanbanIcon,
  LayoutDashboardIcon,
  MailIcon,
  MessagesSquareIcon,
  NewspaperIcon,
  PackageIcon,
  ReceiptIcon,
  SettingsIcon,
  WorkflowIcon,
  FilterIcon,
  HandshakeIcon,
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
    segment: "forms",
    label: "Forms",
    icon: ClipboardListIcon,
    description: "Surveys, quizzes and forms: every response, summarized.",
  },
  {
    segment: "pipelines",
    label: "Pipelines",
    icon: KanbanIcon,
    description: "Drag deals through your sales stages and see what's in the pipeline.",
  },
  {
    segment: "email",
    label: "Email",
    icon: MailIcon,
    description: "Broadcasts, sequences and a drag-and-drop email editor.",
  },
  {
    segment: "automations",
    label: "Automations",
    icon: WorkflowIcon,

    description: "Visual workflows: triggers, waits, branches and actions.",
  },
  {
    segment: "community",
    label: "Community",
    icon: MessagesSquareIcon,
    description: "Members-only discussion spaces with moderation.",
  },
  {
    segment: "affiliates",
    label: "Affiliates",
    icon: HandshakeIcon,
    description: "Partner program: referral links, commissions and payouts.",
  },
  {
    segment: "blog",
    label: "Blog",
    icon: NewspaperIcon,
    description: "Articles with SEO, sitemap and RSS.",
  },
  {
    segment: "courses",
    label: "Courses",
    icon: BookOpenIcon,
    description: "Courses and memberships with drip content and progress tracking.",
  },
  {
    segment: "calendars",
    label: "Calendars",
    icon: CalendarIcon,
    description: "Booking pages with availability and calendar sync.",
  },
];

export const SETTINGS_MODULE: NavModule = {
  segment: "settings",
  label: "Settings",
  icon: SettingsIcon,
  description: "Workspace, team and activity.",
};
