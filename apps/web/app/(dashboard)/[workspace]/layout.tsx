import { ThemeToggle } from "@zfunnel/ui/theme";
import { Toaster } from "@zfunnel/ui/toaster";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { MobileNav } from "@/components/mobile-nav";
import { BottomBar } from "@/components/shell/bottom-bar";
import { CommandPalette, PaletteButton } from "@/components/shell/command-palette";
import { CreateIntent } from "@/components/shell/create-intent";
import { CreateMenu } from "@/components/shell/create-menu";
import { NotificationsBell } from "@/components/shell/notifications-bell";
import { ShellProvider } from "@/components/shell/shell-provider";
import { KeyboardShortcuts } from "@/components/shell/shortcuts";
import { Sidebar } from "@/components/shell/sidebar";
import { UserMenu } from "@/components/user-menu";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { ViewAsBanner } from "@/components/admin/view-as-banner";
import { SuspendedScreen } from "@/components/admin/suspended-screen";
import { currentAdmin } from "@/lib/admin";
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
  const { user, workspace, membership, suspended, viewAs } = await requireWorkspace(params);
  if (suspended) return <SuspendedScreen organizationName={membership.organizationName} />;
  const isAdmin = (await currentAdmin()) !== null;
  const billing = await getBillingState(membership.organizationId);
  const t = await getT();
  const groups = (await listUserWorkspaces(user.id)).map((g) => ({
    organizationName: g.membership.organizationName,
    workspaces: g.workspaces.map((w) => ({ slug: w.slug, name: w.name })),
  }));
  const switcher = <WorkspaceSwitcher current={{ slug: workspace.slug, name: workspace.name }} groups={groups} />;

  return (
    <ShellProvider workspaceSlug={workspace.slug} workspaceGroups={groups}>
      <div className="flex min-h-dvh">
        <Sidebar switcher={switcher} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur lg:px-8">
            <MobileNav workspaceSlug={workspace.slug} switcher={switcher} />
            <Logo className="lg:hidden" showText={false} />
            <div className="flex min-w-0 flex-1 justify-center px-1 sm:justify-start">
              <PaletteButton />
            </div>
            <CreateMenu />
            <NotificationsBell />
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} isAdmin={isAdmin} />
          </header>
          {viewAs && <ViewAsBanner workspaceName={workspace.name} />}
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
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-8 pb-24 lg:px-8 lg:pb-8">{children}</main>
          <Toaster />
        </div>
      </div>
      <BottomBar />
      <CommandPalette />
      <KeyboardShortcuts />
      <Suspense>
        <CreateIntent />
      </Suspense>
    </ShellProvider>
  );
}
