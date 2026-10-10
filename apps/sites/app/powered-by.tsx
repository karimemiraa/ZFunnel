import { currentWorkspace } from "@/lib/site";
import { getTranslator } from "@zfunnel/i18n";

// Same platform URL the worker uses; set by the production compose file.
const APP_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

/** "Powered by ZFunnel" pill; removed for workspaces on a white-label plan that turned it off. */
export async function PoweredBy() {
  const ws = await currentWorkspace();
  if (!ws?.showBadge) return null;
  return (
    <a
      href={`${APP_URL}/?ref=badge`}
      target="_blank"
      rel="noreferrer"
      className="fixed start-4 bottom-4 z-[9998] inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 font-sans text-xs font-medium text-zinc-600 shadow-md ring-1 ring-black/5 backdrop-blur transition hover:text-zinc-900"
    >
      {/* The ZFunnel mark for light backgrounds (docs/brand/README.md). */}
      <svg viewBox="570 486 792 960" className="h-3.5 w-auto" aria-hidden>
        <path
          d="M681 582H1265L952 985"
          fill="none"
          stroke="#F28A22"
          strokeWidth="166"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          fill="#001A57"
          d="M971.3 1095.3A112 112 0 0 1 840.3 993.5L603.5 1298.1A83 83 0 0 0 669 1432H1250A83 83 0 0 0 1250 1266H838.6Z"
        />
      </svg>
      {getTranslator(ws.siteLocale)("common.poweredBy")}
    </a>
  );
}
