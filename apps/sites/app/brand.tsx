import type { SiteWorkspace } from "@/lib/resolve";

/** The workspace's logo when set (white-label), otherwise its name. */
export function Brand({ ws, suffix }: { ws: Pick<SiteWorkspace, "name" | "logoUrl">; suffix?: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-semibold">
      {ws.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ws.logoUrl} alt={ws.name} className="h-7 w-auto max-w-[160px] object-contain" />
      ) : (
        ws.name
      )}
      {suffix && <span className="text-zinc-500">{suffix}</span>}
    </span>
  );
}
