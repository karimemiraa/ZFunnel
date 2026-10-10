import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentCustomer } from "@/lib/customer";
import { courseForStudent } from "@/lib/courses";
import { currentWorkspace } from "@/lib/site";
import { LoginForm } from "../../account/account-client";
import { CourseShell } from "./layout-shell";

export const metadata: Metadata = { robots: { index: false } };

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const { slug } = await params;
  const me = await currentCustomer(ws.id);
  const data = await courseForStudent(ws.id, slug, me?.id ?? null);
  if (!data) notFound();
  const next = data.flat.find((l) => l.open && !l.done) ?? data.flat.find((l) => l.open);
  return (
    <CourseShell data={data} siteName={ws.name}>
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        <div className="aspect-[16/7] bg-gradient-to-br from-indigo-200 via-violet-100 to-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {data.course.imageUrl && <img src={data.course.imageUrl} alt="" className="size-full object-cover" />}
        </div>
        <div className="p-8">
          <h1 className="text-3xl font-bold tracking-tight">{data.course.title}</h1>
          {data.course.description && <p className="mt-3 text-zinc-600">{data.course.description}</p>}
          <div className="mt-6">
            {data.enrolled ? (
              next && (
                <Link
                  href={`/courses/${data.course.slug}/${next.id}`}
                  className="inline-flex h-12 items-center rounded-xl bg-indigo-600 px-6 font-semibold text-white hover:bg-indigo-500"
                >
                  {data.completed ? "Continue where you left off →" : "Start the course →"}
                </Link>
              )
            ) : me ? (
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                You don't have access to this course yet. Free preview lessons are open on the right.
              </p>
            ) : (
              <div className="max-w-sm">
                <p className="mb-3 text-sm text-zinc-600">Already bought it? Sign in to start learning.</p>
                <LoginForm next={`/courses/${data.course.slug}`} />
              </div>
            )}
          </div>
        </div>
      </div>
    </CourseShell>
  );
}
