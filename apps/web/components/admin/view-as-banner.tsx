import { EyeIcon, LogOutIcon } from "lucide-react";
import { stopViewAs } from "@/lib/admin-actions";
import { getT } from "@/lib/i18n";

/** Shown on every dashboard page while a platform admin is in read-only "view as" mode. */
export async function ViewAsBanner({ workspaceName }: { workspaceName: string }) {
  const t = await getT();
  return (
    <div
      role="status"
      className="sticky top-14 z-30 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-b border-amber-500/40 bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950"
    >
      <span className="inline-flex items-center gap-2">
        <EyeIcon className="size-4 shrink-0" />
        {t("admin.viewAs.banner", { workspace: workspaceName })}
      </span>
      <form action={stopViewAs}>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 hover:bg-amber-900"
        >
          <LogOutIcon className="size-3.5 rtl:-scale-x-100" />
          {t("admin.viewAs.exit")}
        </button>
      </form>
    </div>
  );
}
