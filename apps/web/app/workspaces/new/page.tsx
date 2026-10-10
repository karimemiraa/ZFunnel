import { Button } from "@zfunnel/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { LockIcon } from "lucide-react";
import Link from "next/link";
import { BrandedShell } from "@/components/branded-shell";
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
    <BrandedShell homeHref="/">
      <Card className="w-full max-w-md shadow-xl shadow-brand-navy/10">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">{t("workspace.newWorkspace")}</CardTitle>
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
    </BrandedShell>
  );
}
