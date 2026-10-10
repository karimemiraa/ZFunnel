import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { getSession } from "@/lib/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getSession()) redirect("/");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-muted/40 px-4 py-12">
      <Logo className="text-xl" />
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
