import Link from "next/link";
import type { T } from "@zfunnel/i18n";
import { SignOut } from "../account/account-client";

export function CommunityShell({
  siteName,
  children,
  spaces,
  active,
  t,
}: {
  t: T;
  siteName: string;
  children: React.ReactNode;
  spaces: { slug: string; name: string }[];
  active?: string;
}) {
  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4">
          <Link href="/community" className="flex-1 font-semibold">
            {t("community.siteCommunity", { site: siteName })}
          </Link>
          <Link href="/courses" className="text-sm text-zinc-500 hover:text-zinc-900">
            {t("community.courses")}
          </Link>
          <SignOut />
        </div>
      </header>
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[220px_1fr]">
        <nav className="grid content-start gap-1" aria-label={t("community.spaces")}>
          {spaces.map((s) => (
            <Link
              key={s.slug}
              href={`/community/${s.slug}`}
              className={`rounded-xl px-3 py-2 text-sm font-medium ${active === s.slug ? "bg-indigo-100 text-indigo-900" : "text-zinc-600 hover:bg-zinc-100"}`}
            >
              # {s.name}
            </Link>
          ))}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
