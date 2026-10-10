import { smsSettings } from "@zfunnel/db";
import { SmsSettingsForm } from "@/components/sms-settings";
import { requireWorkspace } from "@/lib/context";
import { inWorkspace } from "@/lib/funnels";

export const metadata = { title: "SMS" };

export default async function SmsPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const [s] = await inWorkspace(ctx, (tx) =>
    tx.select({ accountSid: smsSettings.accountSid, fromNumber: smsSettings.fromNumber }).from(smsSettings),
  );
  return <SmsSettingsForm workspaceSlug={ctx.workspace.slug} current={s ?? null} />;
}
