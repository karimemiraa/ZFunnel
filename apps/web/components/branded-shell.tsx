import Link from "next/link";
import { LogoMark } from "@/components/logo";

/** Full-page frame for onboarding-style screens: a navy brand band with the mark, content on top. */
export function BrandedShell({ children, homeHref }: { children: React.ReactNode; homeHref?: string }) {
  const brand = (
    <span className="inline-flex items-center gap-2.5 text-xl font-bold tracking-tight text-white">
      <LogoMark tone="dark" className="h-8" />
      <span dir="ltr">ZFunnel</span>
    </span>
  );
  return (
    <main className="relative flex min-h-dvh flex-col items-center gap-10 bg-muted/40 px-4 pt-14 pb-12">
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_120%_at_100%_100%,rgb(28_130_194/0.45),transparent_70%),linear-gradient(160deg,#000f3a_0%,#001a57_60%,#00307f_100%)]"
      />
      <div className="relative">{homeHref ? <Link href={homeHref}>{brand}</Link> : brand}</div>
      <div className="relative flex w-full justify-center">{children}</div>
    </main>
  );
}
