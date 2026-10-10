import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { redirect } from "next/navigation";
import { BrandedShell } from "@/components/branded-shell";
import { WorkspaceForm } from "@/components/workspace-form";
import { createFirstWorkspace } from "@/lib/actions";
import { ROOT_DOMAIN } from "@/lib/env";
import { getT } from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import { getMemberships } from "@/lib/workspaces";

export async function generateMetadata() {
  return { title: (await getT())("workspace.onboardingTitle") };
}

export default async function OnboardingPage() {
  const user = await requireUser();
  const t = await getT();
  if ((await getMemberships(user.id)).length > 0) redirect("/workspaces/new");

  return (
    <BrandedShell>
      <Card className="w-full max-w-md shadow-xl shadow-brand-navy/10">
        <CardHeader>
          <CardTitle className="text-2xl font-bold tracking-tight">
            {t("workspace.welcome", { name: user.name.split(" ")[0] ?? "" })}
          </CardTitle>
          <CardDescription>{t("workspace.onboardingIntro")}</CardDescription>
        </CardHeader>
        <CardContent>
          <WorkspaceForm
            action={createFirstWorkspace}
            rootDomain={ROOT_DOMAIN}
            submitLabel={t("workspace.createWorkspace")}
            askOrganization
          />
        </CardContent>
      </Card>
    </BrandedShell>
  );
}
