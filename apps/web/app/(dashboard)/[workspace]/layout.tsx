import { ThemeToggle } from "@zfunnel/ui/theme";
import { Toaster } from "@zfunnel/ui/toaster";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { getBillingState } from "@/lib/billing";
import { requireWorkspace } from "@/lib/context";
import { getT } from "@/lib/i18n";
import { listUserWorkspaces } from "@/lib/workspaces";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { user, workspace, membership } = await requireWorkspace(params);
  const billing = await getBillingState(membership.organizationId);
  const t = await getT();
  const groups = (await listUserWorkspaces(user.id)).map((g) => ({
    organizationName: g.membership.organizationName,
    workspaces: g.workspaces.map((w) => ({ slug: w.slug, name: w.name })),
  }));
  const switcher = <WorkspaceSwitcher current={{ slug: workspace.slug, name: workspace.name }} groups={groups} />;

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-4 overflow-y-auto border-e bg-sidebar p-4 lg:flex">
        <Link href={`/${workspace.slug}`} className="px-2 py-1.5">
          <Logo className="text-[1.0625rem]" />
        </Link>
        {switcher}
        <SidebarNav workspaceSlug={workspace.slug} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur lg:px-8">
          <MobileNav workspaceSlug={workspace.slug} switcher={switcher} />
          <Logo className="lg:hidden" showText={false} />
          <div className="flex-1" />
          <ThemeToggle />
          <UserMenu name={user.name} email={user.email} />
        </header>
        {(billing.status === "expired" ||
          billing.status === "past_due" ||
          (billing.status === "trial" && (billing.daysLeft ?? 99) <= 3)) && (
          <div
            className={
              billing.status === "trial"
                ? "border-b bg-brand-orange/10 px-4 py-2 text-center text-sm text-orange-950 dark:text-orange-100"
                : "border-b bg-amber-500/15 px-4 py-2 text-center text-sm text-amber-900 dark:text-amber-200"
            }
          >
            {billing.status === "expired"
              ? t("billing.banner.trialEnded")
              : billing.status === "past_due"
                ? t("billing.banner.pastDue")
                : t("billing.banner.trialEndsIn", { count: billing.daysLeft ?? 0 })}{" "}
            <Link href={`/${workspace.slug}/settings/billing`} className="font-semibold underline underline-offset-2">
              {billing.status === "past_due" ? t("billing.banner.updatePayment") : t("billing.banner.choosePlan")}
            </Link>
          </div>
        )}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 lg:px-8">{children}</main>
        <Toaster />
      </div>
    </div>
  );
}
