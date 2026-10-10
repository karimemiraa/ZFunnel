"use client";

import { Avatar, AvatarFallback } from "@zfunnel/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zfunnel/ui/dropdown-menu";
import { useLocale, useT } from "@zfunnel/i18n/react";
import { LanguagesIcon, LogOutIcon, ShieldIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { setLanguage } from "@/lib/i18n-actions";
import { signOut } from "@/lib/actions";

export function UserMenu({ name, email, isAdmin = false }: { name: string; email: string; isAdmin?: boolean }) {
  const t = useT();
  const other = useLocale() === "ar" ? "en" : "ar";
  const router = useRouter();
  const [, start] = useTransition();
  const initials = name
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-[3px]"
        aria-label={t("shell.accountMenu")}
      >
        <Avatar className="size-8">
          <AvatarFallback className="bg-primary/15 text-xs font-semibold text-primary">{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="truncate font-medium">{name}</div>
          <div className="truncate text-xs font-normal text-muted-foreground">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <ShieldIcon /> {t("admin.menuLink")}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          // Offers the other language, written in that language ("العربية" / "English").
          onSelect={() =>
            start(async () => {
              await setLanguage(other);
              router.refresh();
            })
          }
        >
          <LanguagesIcon /> <span lang={other}>{t("shell.switchLanguage")}</span>
        </DropdownMenuItem>
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOutIcon /> {t("shell.signOut")}
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
