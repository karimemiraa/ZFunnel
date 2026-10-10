import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
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
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-12">
      <Logo className="text-xl" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">{t("workspace.welcome", { name: user.name.split(" ")[0] ?? "" })}</CardTitle>
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
    </main>
  );
}
