import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "@/components/settings-tabs";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  return (
    <>
      <PageHeader title="Settings" description="Manage this workspace and who can access it." />
      <SettingsTabs base={`/${workspace}/settings`} />
      {children}
    </>
  );
}
