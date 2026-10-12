import { cn } from "@zfunnel/ui/lib/utils";
import { Children } from "react";

/** Card with a title and a divided list; shows `empty` when it has no items. */
export function Section({
  title,
  empty,
  children,
  className,
  action,
  testId,
}: {
  title: string;
  empty?: string;
  children?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  testId?: string;
}) {
  const has = Children.toArray(children).length > 0;
  return (
    <section className={cn("rounded-xl border bg-card", className)} data-testid={testId}>
      <div className="flex items-center justify-between gap-2 border-b px-5 py-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {has ? (
        <ul className="divide-y">{children}</ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
