import { notFound } from "next/navigation";
import { EmailEditor } from "@/components/email/email-editor";
import { getEmailDesign } from "@/lib/email";
import { requireUser } from "@/lib/session";
import { getWorkspaceForUser } from "@/lib/workspaces";

export const metadata = { title: "Email editor" };

export default async function EmailEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; emailId: string }>;
  searchParams: Promise<{ b?: string }>;
}) {
  const [{ workspace, emailId }, { b }, user] = await Promise.all([params, searchParams, requireUser()]);
  const ctx = await getWorkspaceForUser(user.id, workspace);
  if (!ctx) notFound();
  const email = await getEmailDesign(ctx, emailId);
  if (!email) notFound();
  const back = b && /^[0-9a-f-]{36}$/i.test(b) ? `/${workspace}/email/${b}` : `/${workspace}/email`;
  return (
    <EmailEditor
      workspaceSlug={workspace}
      emailId={email.id}
      name={email.name}
      backHref={back}
      initialData={email.content as never}
    />
  );
}
