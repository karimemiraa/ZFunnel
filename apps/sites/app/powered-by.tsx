import { currentWorkspace } from "@/lib/site";

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
      className="fixed bottom-4 left-4 z-[9998] inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 font-sans text-xs font-medium text-zinc-600 shadow-md ring-1 ring-black/5 backdrop-blur transition hover:text-zinc-900"
    >
      <svg viewBox="0 0 24 24" className="size-3.5 text-indigo-600" fill="currentColor" aria-hidden>
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
      </svg>
      Powered by ZFunnel
    </a>
  );
}
