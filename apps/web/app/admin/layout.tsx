import { ThemeToggle } from "@zfunnel/ui/theme";
import { ShieldIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { requireAdmin } from "@/lib/admin";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())("admin.title"), robots: { index: false } };
}

/** Platform admin area (ADR-024). Everyone who is not a platform admin gets a 404. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  const t = await getT();
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 border-b bg-sidebar p-4 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:border-e lg:border-b-0">
        <Link href="/admin" className="flex items-center justify-between gap-2 px-2 py-1">
          <Logo />
          <span
            className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-primary"
            title={t("admin.title")}
          >
            <ShieldIcon className="size-3.5" />
          </span>
        </Link>
        <AdminNav />
        <Link
          href="/"
          className="mt-auto hidden rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground lg:block"
        >
          {t("admin.backToApp")}
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur lg:px-8">
          <span className="text-sm font-semibold">{t("admin.title")}</span>
          <div className="flex-1" />
          <ThemeToggle />
          <UserMenu name={admin.name} email={admin.email} isAdmin />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
