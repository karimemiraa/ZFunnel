import { CheckIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { Logo, LogoMark } from "@/components/logo";
import { getT } from "@/lib/i18n";
import { getSession } from "@/lib/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/");
  const t = await getT();
  const points = [t("auth.panelPoint1"), t("auth.panelPoint2"), t("auth.panelPoint3")];
  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* Branded panel (start side): navy gradient, the mark and a short pitch. */}
      <section className="relative hidden overflow-hidden bg-brand-navy p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(90%_70%_at_100%_100%,rgb(28_130_194/0.55),transparent_70%),linear-gradient(160deg,#000f3a_0%,#001a57_55%,#00307f_100%)]"
        />
        <div className="relative inline-flex items-center gap-2.5 text-lg font-bold tracking-tight">
          <LogoMark tone="dark" className="h-8" />
          <span dir="ltr">ZFunnel</span>
        </div>
        <div className="relative max-w-md space-y-8">
          <h2 className="text-4xl leading-tight font-bold tracking-tight text-balance">{t("auth.panelTitle")}</h2>
          <ul className="space-y-3.5 text-base text-white/80">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-orange text-brand-navy">
                  <CheckIcon className="size-3.5" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative h-1 w-16 rounded-full bg-brand-orange" aria-hidden />
      </section>
      <section className="flex flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-12 sm:px-8">
        <Logo className="text-xl lg:hidden" />
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}
