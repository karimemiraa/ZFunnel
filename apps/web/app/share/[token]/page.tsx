import { Toaster } from "@zfunnel/ui/toaster";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { STEP_COLORS, stepLabelKey } from "@/components/funnels/step-type";
import { getT } from "@/lib/i18n";
import { getSharedFunnel } from "@/lib/share";
import { requireUser } from "@/lib/session";
import { canManage, listUserWorkspaces } from "@/lib/workspaces";
import { ImportForm } from "./import-form";

export async function generateMetadata() {
  return { title: (await getT())("funnels.shared.title"), robots: { index: false } };
}

export default async function SharePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { token } = await params;
  const shared = await getSharedFunnel(token);
  if (!shared) notFound();
  const user = await requireUser();
  const t = await getT();
  const groups = await listUserWorkspaces(user.id);
  const targets = groups
    .filter((g) => canManage(g.membership.role))
    .flatMap((g) => g.workspaces.map((w) => ({ slug: w.slug, name: w.name })));
  const active = Math.min(Math.max(0, Number((await searchParams).step) || 0), shared.steps.length - 1);
  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="flex h-14 items-center border-b bg-background px-6">
        <Logo />
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-[320px_1fr]">
        <aside className="grid content-start gap-5 rounded-2xl border bg-card p-6">
          <div>
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t("funnels.shared.title")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{shared.funnel.name}</h1>
            <p className="text-sm text-muted-foreground">{t("funnels.shared.pages", { count: shared.steps.length })}</p>
          </div>
          <ol className="grid gap-1.5">
            {shared.steps.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`?step=${i}`}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${i === active ? "bg-primary/10 font-semibold" : "hover:bg-accent"}`}
                >
                  <span className="size-2.5 rounded-full" style={{ background: STEP_COLORS[s.type] }} />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-xs text-muted-foreground">{t(stepLabelKey(s.type))}</span>
                </a>
              </li>
            ))}
          </ol>
          <ImportForm token={token} workspaces={targets} />
          <p className="text-xs text-muted-foreground">{t("funnels.shared.note")}</p>
        </aside>
        <div className="overflow-hidden rounded-2xl border bg-background shadow-sm">
          <iframe title={t("funnels.preview")} src={`/share/${token}/${active}`} className="h-[75vh] w-full" />
        </div>
      </div>
      <Toaster />
    </div>
  );
}
