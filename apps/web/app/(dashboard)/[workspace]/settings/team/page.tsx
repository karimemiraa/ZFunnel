import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@zfunnel/ui/card";
import { asc, eq, getDb, schema } from "@zfunnel/db";
import { requireWorkspace } from "@/lib/context";

export const metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ workspace: string }> }) {
  const { membership } = await requireWorkspace(params);
  const members = await getDb()
    .select({ id: schema.member.id, role: schema.member.role, name: schema.user.name, email: schema.user.email })
    .from(schema.member)
    .innerJoin(schema.user, eq(schema.member.userId, schema.user.id))
    .where(eq(schema.member.organizationId, membership.organizationId))
    .orderBy(asc(schema.user.name));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team members</CardTitle>
        <CardDescription>
          Everyone in {membership.organizationName}. Email invitations arrive with email sending in Phase 2.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{m.name}</div>
                <div className="truncate text-xs text-muted-foreground">{m.email}</div>
              </div>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize">{m.role}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
