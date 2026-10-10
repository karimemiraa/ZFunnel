import type { MessageKey, T } from "@zfunnel/i18n";
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
  InboxIcon,
  PresentationIcon,
} from "lucide-react";

/** Labels and descriptions live in the i18n `nav` namespace, keyed by segment ("overview" for ""). */
export type NavModule = {
  /** URL segment under /[workspace]. Empty string = overview. */
  segment: string;
  icon: LucideIcon;
  /** Roadmap phase that ships it; undefined = available now. */
  phase?: number;
};

export const NAV_MODULES: NavModule[] = [
  { segment: "", icon: LayoutDashboardIcon },
  {
    segment: "funnels",
    icon: FilterIcon,
  },
  {
    segment: "products",
    icon: PackageIcon,
  },
  {
    segment: "orders",
    icon: ReceiptIcon,
  },
  {
    segment: "analytics",
    icon: BarChart3Icon,
  },
  {
    segment: "contacts",
    icon: ContactIcon,
  },
  {
    segment: "forms",
    icon: ClipboardListIcon,
  },
  {
    segment: "pipelines",
    icon: KanbanIcon,
  },
  {
    segment: "email",
    icon: MailIcon,
  },
  {
    segment: "automations",
    icon: WorkflowIcon,
  },
  {
    segment: "inbox",
    icon: InboxIcon,
  },
  {
    segment: "community",
    icon: MessagesSquareIcon,
  },
  {
    segment: "affiliates",
    icon: HandshakeIcon,
  },
  {
    segment: "blog",
    icon: NewspaperIcon,
  },
  {
    segment: "courses",
    icon: BookOpenIcon,
  },
  {
    segment: "webinars",
    icon: PresentationIcon,
  },
  {
    segment: "calendars",
    icon: CalendarIcon,
  },
];

export const SETTINGS_MODULE: NavModule = {
  segment: "settings",
  icon: SettingsIcon,
};

/** Translated label or description of a module. */
export const navText = (t: T, segment: string, field: "label" | "description") =>
  t(`nav.${segment || "overview"}.${field}` as MessageKey);
