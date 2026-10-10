import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { BrandingForm } from "@/components/branding-form";
import { RenameForm } from "@/components/rename-form";
import { getBillingState } from "@/lib/billing";
import { requireWorkspace } from "@/lib/context";
import { ROOT_DOMAIN } from "@/lib/env";
import { canManage } from "@/lib/workspaces";
import { SiteLanguageForm } from "@/components/site-language-form";
import { getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await getT())("settings.title") };
}

export default async function GeneralSettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace, membership } = await requireWorkspace(params);
  const editable = canManage(membership.role);
  const billing = await getBillingState(membership.organizationId);
  const t = await getT();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.general")}</CardTitle>
          <CardDescription>{editable ? t("settings.renameHint") : t("settings.onlyAdmins")}</CardDescription>
        </CardHeader>
        <CardContent>
          <RenameForm slug={workspace.slug} name={workspace.name} disabled={!editable} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.siteLanguage")}</CardTitle>
          <CardDescription>{t("settings.siteLanguageHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SiteLanguageForm slug={workspace.slug} current={workspace.siteLocale} disabled={!editable} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.branding")}</CardTitle>
          <CardDescription>{t("settings.brandingHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <BrandingForm
            slug={workspace.slug}
            name={workspace.name}
            disabled={!editable}
            canWhiteLabel={billing.status !== "expired" && billing.plan.features.whiteLabel}
            initial={{
              logoUrl: workspace.logoUrl ?? "",
              brandColor: workspace.brandColor,
              hideBadge: workspace.hideBadge,
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.subdomain")}</CardTitle>
          <CardDescription>{t("settings.subdomainHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <code className="rounded bg-muted px-2 py-1 text-sm" dir="ltr">
            {workspace.slug}.{ROOT_DOMAIN}
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
