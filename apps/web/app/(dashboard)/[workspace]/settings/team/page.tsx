import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { asc, eq, getDb, schema } from "@zfunnel/db";
import { requireWorkspace } from "@/lib/context";
import { getT } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: (await getT())("settings.tabs.team") };
}

export default async function TeamPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { membership } = await requireWorkspace(params);
  const members = await getDb()
    .select({ id: schema.member.id, role: schema.member.role, name: schema.user.name, email: schema.user.email })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(eq(schema.member.organizationId, membership.organizationId))
    .orderBy(asc(schema.user.name));
  const t = await getT();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("team.members")}</CardTitle>
        <CardDescription>{t("team.description", { organization: membership.organizationName })}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{m.name}</div>
                <div dir="ltr" className="truncate text-start text-xs text-muted-foreground">
                  {m.email}
                </div>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">
                {m.role === "owner" || m.role === "admin" || m.role === "member" ? t(`team.roles.${m.role}`) : m.role}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
