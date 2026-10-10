import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { listUserWorkspaces } from "@/lib/workspaces";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const groups = await listUserWorkspaces(session.user.id);
  const first = groups.flatMap((g) => g.workspaces)[0];
  if (first) redirect(`/${first.slug}`);
  // Member of an organization that has no workspace yet (e.g. invited before one existed).
  redirect(groups.length ? "/workspaces/new" : "/onboarding");
}
