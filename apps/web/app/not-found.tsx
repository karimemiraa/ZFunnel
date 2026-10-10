import { Button } from "@zfunnel/ui/button";
import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo className="text-xl" />
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-sm text-muted-foreground">It may have moved, or you may not have access to it.</p>
      </div>
      <Button asChild>
        <Link href="/">Go to dashboard</Link>
      </Button>
    </main>
  );
}
