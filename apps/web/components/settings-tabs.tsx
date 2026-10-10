"use client";

import { cn } from "@zfunnel/ui/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SettingsTabs({ base }: { base: string }) {
  const pathname = usePathname();
  const tabs = [
    { href: base, label: "General" },
    { href: `${base}/payments`, label: "Payments" },
    { href: `${base}/domains`, label: "Domains" },
    { href: `${base}/team`, label: "Team" },
    { href: `${base}/activity`, label: "Activity" },
  ];
  return (
    <div className="mb-8 flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            "-mb-px border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
            pathname === t.href
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
