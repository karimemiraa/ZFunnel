import { cn } from "../lib/utils";

/** Inline error/success message under a form. Renders nothing without a message. */
function FormMessage({
  message,
  tone = "error",
  className,
}: {
  message?: string | null;
  tone?: "error" | "success";
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "text-sm",
        tone === "error" ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      {message}
    </p>
  );
}

export { FormMessage };
