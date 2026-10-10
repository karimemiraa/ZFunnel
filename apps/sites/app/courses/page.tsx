import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentCustomer } from "@/lib/customer";
import { myCourses } from "@/lib/courses";
import { currentWorkspace } from "@/lib/site";
import { LoginForm, SignOut } from "../account/account-client";

export const metadata: Metadata = { title: "My courses", robots: { index: false } };

export default async function MyCoursesPage() {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const me = await currentCustomer(ws.id);
  if (!me)
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4 text-zinc-900">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-zinc-500">{ws.name}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Member area</h1>
          <p className="mt-2 mb-6 text-sm text-zinc-600">
            Sign in with the email you used to buy. We'll send you a secure link.
          </p>
          <LoginForm next="/courses" />
        </div>
      </main>
    );
  const list = await myCourses(ws.id, me.id);
  return (
    <main className="min-h-dvh bg-zinc-50 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-6 px-4">
          <span className="flex-1 font-semibold">{ws.name}</span>
          <Link href="/account" className="text-sm font-medium text-zinc-500 hover:text-zinc-900">
            Account
          </Link>
          <SignOut />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">My courses</h1>
        {list.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed border-zinc-300 p-10 text-center text-zinc-500">
            You don't have any courses yet.
          </p>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((c) => (
              <Link
                key={c.id}
                href={`/courses/${c.slug}`}
                className="group overflow-hidden rounded-2xl border border-zinc-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="aspect-[16/9] bg-gradient-to-br from-indigo-200 via-violet-100 to-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.imageUrl && <img src={c.imageUrl} alt="" className="size-full object-cover" />}
                </div>
                <div className="p-5">
                  <h2 className="font-semibold group-hover:underline">{c.title}</h2>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${c.percent}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">
                    {c.completed} of {c.lessons} lessons · {c.percent}%
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
