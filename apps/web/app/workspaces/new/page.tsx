import { Button } from "@zfunnel/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { LockIcon } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { WorkspaceForm } from "@/components/workspace-form";
import { createWorkspace } from "@/lib/actions";
import { ROOT_DOMAIN } from "@/lib/env";
import { getT } from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import { canManage, getMemberships } from "@/lib/workspaces";

export async function generateMetadata() {
  return { title: (await getT())("workspace.newWorkspace") };
}

export default async function NewWorkspacePage() {
  const user = await requireUser();
  const t = await getT();
  const manageable = (await getMemberships(user.id)).filter((m) => !m.suspended && canManage(m.role));

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-12">
      <Link href="/">
        <Logo className="text-xl" />
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">{t("workspace.newWorkspace")}</CardTitle>
          <CardDescription>{t("workspace.newIntro")}</CardDescription>
        </CardHeader>
        <CardContent>
          {manageable.length ? (
            <WorkspaceForm
              action={createWorkspace}
              rootDomain={ROOT_DOMAIN}
              submitLabel={t("workspace.createWorkspace")}
              organizations={manageable.map((m) => ({ id: m.organizationId, name: m.organizationName }))}
            />
          ) : (
            <EmptyState
              icon={<LockIcon />}
              title={t("workspace.askAdmin")}
              description={t("workspace.askAdminBody")}
              action={
                <Button asChild variant="outline">
                  <Link href="/">{t("common.back")}</Link>
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
