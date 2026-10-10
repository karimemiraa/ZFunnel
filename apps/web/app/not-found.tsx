import { Button } from "@zfunnel/ui/button";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { getT } from "@/lib/i18n";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo className="text-xl" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">{t("auth.notFoundTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("auth.notFoundBody")}</p>
      </div>
      <Button asChild>
        <Link href="/">{t("auth.goToDashboard")}</Link>
      </Button>
    </main>
  );
}
