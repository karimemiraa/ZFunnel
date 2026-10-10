import { ThemeToggle } from "@zfunnel/ui/theme";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { MobileNav } from "@/components/mobile-nav";
import { SidebarNav } from "@/components/sidebar-nav";
import { UserMenu } from "@/components/user-menu";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { requireWorkspace } from "@/lib/context";
import { listUserWorkspaces } from "@/lib/workspaces";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { user, workspace } = await requireWorkspace(params);
  const groups = (await listUserWorkspaces(user.id)).map((g) => ({
    organizationName: g.membership.organizationName,
    workspaces: g.workspaces.map((w) => ({ slug: w.slug, name: w.name })),
  }));
  const switcher = <WorkspaceSwitcher current={{ slug: workspace.slug, name: workspace.name }} groups={groups} />;

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-4 border-r bg-sidebar p-4 lg:flex">
        <Link href={`/${workspace.slug}`} className="px-2 py-1">
          <Logo />
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
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
