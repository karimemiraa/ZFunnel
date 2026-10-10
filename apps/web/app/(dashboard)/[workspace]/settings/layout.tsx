import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "@/components/settings-tabs";
import { getT } from "@/lib/i18n";

export default async function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;
  const t = await getT();
  return (
    <>
      <PageHeader title={t("settings.title")} description={t("settings.description")} />
      <SettingsTabs base={`/${workspace}/settings`} />
      {children}
    </>
  );
}
