import { Button } from "@zfunnel/ui/button";
import { PauseCircleIcon } from "lucide-react";
import { Logo } from "@/components/logo";
import { signOut } from "@/lib/actions";
import { getT } from "@/lib/i18n";

/** What members of a suspended organization see instead of the dashboard. */
export async function SuspendedScreen({ organizationName }: { organizationName: string }) {
  const t = await getT();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-12 text-center">
      <Logo className="text-xl" />
      <div className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <PauseCircleIcon className="size-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">{t("admin.suspended.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("admin.suspended.body", { organization: organizationName })}</p>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            {t("admin.suspended.signOut")}
          </Button>
        </form>
      </div>
    </main>
  );
}
