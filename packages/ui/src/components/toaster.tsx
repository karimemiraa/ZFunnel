"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner theme={(resolvedTheme as "light" | "dark") ?? "system"} position="bottom-right" richColors closeButton />
  );
}

export { toast, Toaster };
