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
  /** Live count shown next to the label (see ShellCounts). */
  badge?: "inbox" | "orders";
};

export type NavGroupId = "sell" | "marketing" | "customers" | "learn" | "insights";
export type NavGroup = { id: NavGroupId; items: NavModule[] };

export const OVERVIEW_MODULE: NavModule = { segment: "", icon: LayoutDashboardIcon };
export const SETTINGS_MODULE: NavModule = { segment: "settings", icon: SettingsIcon };

/** Sidebar groups approved in the Phase 8 owner decisions (ROADMAP 8.1). */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "sell",
    items: [
      { segment: "funnels", icon: FilterIcon },
      { segment: "products", icon: PackageIcon },
      { segment: "orders", icon: ReceiptIcon, badge: "orders" },
    ],
  },
  {
    id: "marketing",
    items: [
      { segment: "email", icon: MailIcon },
      { segment: "automations", icon: WorkflowIcon },
      { segment: "forms", icon: ClipboardListIcon },
      { segment: "blog", icon: NewspaperIcon },
      { segment: "webinars", icon: PresentationIcon },
      { segment: "affiliates", icon: HandshakeIcon },
    ],
  },
  {
    id: "customers",
    items: [
      { segment: "contacts", icon: ContactIcon },
      { segment: "pipelines", icon: KanbanIcon },
      { segment: "inbox", icon: InboxIcon, badge: "inbox" },
      { segment: "calendars", icon: CalendarIcon },
    ],
  },
  {
    id: "learn",
    items: [
      { segment: "courses", icon: BookOpenIcon },
      { segment: "community", icon: MessagesSquareIcon },
    ],
  },
  { id: "insights", items: [{ segment: "analytics", icon: BarChart3Icon }] },
];

/** Overview plus every grouped module, in sidebar order (settings is separate). */
export const NAV_MODULES: NavModule[] = [OVERVIEW_MODULE, ...NAV_GROUPS.flatMap((g) => g.items)];

export const findModule = (segment: string) => [...NAV_MODULES, SETTINGS_MODULE].find((m) => m.segment === segment);

/** Translated label or description of a module. */
export const navText = (t: T, segment: string, field: "label" | "description") =>
  t(`nav.${segment || "overview"}.${field}` as MessageKey);

export type CreateItem = {
  id: "funnel" | "product" | "contact" | "broadcast" | "automation" | "course" | "post" | "form";
  segment: string;
  /** Opens the page's own "new" dialog/button (see CreateIntent). */
  intent: boolean;
};

/** Global "+ Create" menu: each item lands on the module's existing creation flow. */
export const CREATE_ITEMS: CreateItem[] = [
  { id: "funnel", segment: "funnels", intent: true },
  { id: "product", segment: "products", intent: true },
  { id: "contact", segment: "contacts", intent: true },
  { id: "broadcast", segment: "email", intent: true },
  { id: "automation", segment: "automations", intent: true },
  { id: "course", segment: "courses", intent: true },
  { id: "post", segment: "blog", intent: true },
  // Forms are blocks inside funnel steps, so "new form" starts from the forms overview.
  { id: "form", segment: "forms", intent: false },
];

export const createHref = (workspaceSlug: string, item: CreateItem) =>
  `/${workspaceSlug}/${item.segment}${item.intent ? "?create=1" : ""}`;

/** "g" then a key jumps to a module (8.5h). */
export const GO_SHORTCUTS: { key: string; segment: string; label: MessageKey }[] = [
  { key: "h", segment: "", label: "topbar.shortcuts.goOverview" },
  { key: "f", segment: "funnels", label: "topbar.shortcuts.goFunnels" },
  { key: "c", segment: "contacts", label: "topbar.shortcuts.goContacts" },
  { key: "o", segment: "orders", label: "topbar.shortcuts.goOrders" },
  { key: "p", segment: "products", label: "topbar.shortcuts.goProducts" },
  { key: "i", segment: "inbox", label: "topbar.shortcuts.goInbox" },
  { key: "e", segment: "email", label: "topbar.shortcuts.goEmail" },
  { key: "a", segment: "automations", label: "topbar.shortcuts.goAutomations" },
  { key: "n", segment: "analytics", label: "topbar.shortcuts.goAnalytics" },
  { key: "s", segment: "settings", label: "topbar.shortcuts.goSettings" },
];

/** Settings sub-pages (command palette "settings" results). Labels are `settings.tabs.*`. */
export const SETTINGS_PAGES = [
  { path: "", key: "general" },
  { path: "payments", key: "payments" },
  { path: "domains", key: "domains" },
  { path: "team", key: "team" },
  { path: "billing", key: "billing" },
  { path: "sms", key: "sms" },
  { path: "tracking", key: "tracking" },
  { path: "developers", key: "developers" },
  { path: "activity", key: "activity" },
] as const;
