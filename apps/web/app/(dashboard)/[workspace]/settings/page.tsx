import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { BrandingForm } from "@/components/branding-form";
import { RenameForm } from "@/components/rename-form";
import { getBillingState } from "@/lib/billing";
import { requireWorkspace } from "@/lib/context";
import { ROOT_DOMAIN } from "@/lib/env";
import { canManage } from "@/lib/workspaces";

export const metadata = { title: "Settings" };

export default async function GeneralSettingsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace, membership } = await requireWorkspace(params);
  const editable = canManage(membership.role);
  const billing = await getBillingState(membership.organizationId);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>
            {editable ? "Rename this workspace." : "Only owners and admins can change these settings."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RenameForm slug={workspace.slug} name={workspace.name} disabled={!editable} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Make your customer-facing pages and emails look like your business.</CardDescription>
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
          <CardTitle>Free subdomain</CardTitle>
          <CardDescription>
            Published funnels are always available here, even after you connect your own domain in Settings → Domains.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="rounded bg-muted px-2 py-1 text-sm">
            {workspace.slug}.{ROOT_DOMAIN}
          </code>
        </CardContent>
      </Card>
    </div>
  );
}
