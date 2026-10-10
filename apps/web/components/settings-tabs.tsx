"use client";

import { cn } from "@zfunnel/ui/lib/utils";
import Link from "next/link";
import { useT } from "@zfunnel/i18n/react";
import { usePathname } from "next/navigation";

export function SettingsTabs({ base }: { base: string }) {
  const pathname = usePathname();
  const t = useT();
  const tabs = [
    { href: base, label: t("settings.tabs.general") },
    { href: `${base}/payments`, label: t("settings.tabs.payments") },
    { href: `${base}/domains`, label: t("settings.tabs.domains") },
    { href: `${base}/team`, label: t("settings.tabs.team") },
    { href: `${base}/billing`, label: t("settings.tabs.billing") },
    { href: `${base}/sms`, label: t("settings.tabs.sms") },
    { href: `${base}/tracking`, label: t("settings.tabs.tracking") },
    { href: `${base}/developers`, label: t("settings.tabs.developers") },
    { href: `${base}/activity`, label: t("settings.tabs.activity") },
  ];
  return (
    <div className="mb-8 flex gap-1 overflow-x-auto border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
            pathname === tab.href
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
