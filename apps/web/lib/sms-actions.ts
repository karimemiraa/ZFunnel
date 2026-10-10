"use server";

import { smsSettings } from "@zfunnel/db";
import { sealSecret } from "@zfunnel/email";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inWorkspace } from "./funnels";
import { getT, localizeMessage } from "./i18n";
import { requireUser } from "./session";
import { canManage, getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true; message?: string } | { ok: false; error: string };

const schema = z.object({
  accountSid: z
    .string()
    .trim()
    .regex(/^AC[0-9a-f]{32}$/i, "sms.sidFormat"),
  authToken: z.string().trim().max(100),
  fromNumber: z
    .string()
    .trim()
    .regex(/^\+\d{8,15}$/, "sms.phoneFormat"),
});

/** Saves Twilio credentials. Leave the token empty to keep the stored one. */
export async function saveSmsSettings(workspaceSlug: string, input: z.input<typeof schema>): Promise<Result> {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  const t = await getT();
  if (!ctx || !canManage(ctx.membership.role)) return { ok: false, error: t("sms.onlyAdmins") };
  const d = schema.safeParse(input);
  if (!d.success) return { ok: false, error: localizeMessage(t, d.error.issues[0]!.message)! };
  const err = await inWorkspace(ctx, async (tx) => {
    const [cur] = await tx.select().from(smsSettings);
    if (!cur && !d.data.authToken) return t("sms.enterToken");
    const sealed = d.data.authToken ? sealSecret(d.data.authToken) : cur!.authTokenSealed;
    await tx
      .insert(smsSettings)
      .values({
        workspaceId: ctx.workspace.id,
        accountSid: d.data.accountSid,
        authTokenSealed: sealed,
        fromNumber: d.data.fromNumber,
      })
      .onConflictDoUpdate({
        target: smsSettings.workspaceId,
        set: { accountSid: d.data.accountSid, authTokenSealed: sealed, fromNumber: d.data.fromNumber },
      });
    return null;
  });
  if (err) return { ok: false, error: err };
  await recordAudit(ctx, user.id, { action: "sms.settings_updated", entityType: "sms_settings" });
  revalidatePath(`/${workspaceSlug}/settings/sms`);
  return { ok: true, message: t("sms.saved") };
}
