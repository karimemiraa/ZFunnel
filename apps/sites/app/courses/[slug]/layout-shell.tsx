import { CheckCircle2Icon, LockIcon, PlayCircleIcon } from "lucide-react";
import Link from "next/link";
import type { courseForStudent } from "@/lib/courses";

type Data = NonNullable<Awaited<ReturnType<typeof courseForStudent>>>;

export function CourseShell({
  data,
  active,
  children,
  siteName,
}: {
  data: Data;
  active?: string;
  children: React.ReactNode;
  siteName: string;
}) {
  const total = data.flat.length;
  const pct = total ? Math.round((data.completed / total) * 100) : 0;
  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/courses" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
            ← {siteName}
          </Link>
          <span className="flex-1 truncate font-semibold">{data.course.title}</span>
          {data.enrolled && (
            <span className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex">
              <span className="h-1.5 w-28 overflow-hidden rounded-full bg-zinc-100">
                <span className="block h-full rounded-full bg-indigo-600" style={{ width: `${pct}%` }} />
              </span>
              {pct}% complete
            </span>
          )}
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">{children}</div>
        <aside className="grid content-start gap-4 lg:sticky lg:top-6 lg:self-start">
          {data.modules.map((m) => (
            <section key={m.id} className="rounded-2xl border border-zinc-200 bg-white">
              <h2 className="border-b border-zinc-100 px-4 py-3 text-sm font-semibold">{m.title}</h2>
              <ul>
                {m.lessons.map((l) => {
                  const icon = l.done ? (
                    <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600" />
                  ) : l.open ? (
                    <PlayCircleIcon className="size-4 shrink-0 text-indigo-600" />
                  ) : (
                    <LockIcon className="size-4 shrink-0 text-zinc-400" />
                  );
                  const body = (
                    <>
                      {icon}
                      <span className="min-w-0 flex-1 truncate">{l.title}</span>
                      {l.unlockAt && (
                        <span className="shrink-0 text-[11px] text-zinc-400">
                          {l.unlockAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </>
                  );
                  return (
                    <li key={l.id}>
                      {l.open ? (
                        <Link
                          href={`/courses/${data.course.slug}/${l.id}`}
                          className={`flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-zinc-50 ${active === l.id ? "bg-indigo-50 font-semibold text-indigo-900" : ""}`}
                        >
                          {body}
                        </Link>
                      ) : (
                        <span className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-zinc-400">{body}</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </aside>
      </div>
    </div>
  );
}
