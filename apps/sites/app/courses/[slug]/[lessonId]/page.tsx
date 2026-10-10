import { toEmbed } from "@zfunnel/blocks";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentCustomer } from "@/lib/customer";
import { courseForStudent } from "@/lib/courses";
import { currentWorkspace } from "@/lib/site";
import { CompleteButton } from "../../student-ui";
import { CourseShell } from "../layout-shell";

export const metadata: Metadata = { robots: { index: false } };

export default async function LessonPage({ params }: { params: Promise<{ slug: string; lessonId: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) notFound();
  const { slug, lessonId } = await params;
  const me = await currentCustomer(ws.id);
  const data = await courseForStudent(ws.id, slug, me?.id ?? null);
  if (!data) notFound();
  const i = data.flat.findIndex((l) => l.id === lessonId);
  const lesson = data.flat[i];
  if (!lesson) notFound();
  if (!lesson.open) redirect(`/courses/${slug}`);
  const prev = data.flat
    .slice(0, i)
    .reverse()
    .find((l) => l.open);
  const next = data.flat.slice(i + 1).find((l) => l.open);
  const video = lesson.videoUrl ? toEmbed(lesson.videoUrl) : null;
  return (
    <CourseShell data={data} active={lesson.id} siteName={ws.name}>
      <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
        {video && (
          <div className="aspect-video bg-black">
            {video.kind === "iframe" ? (
              <iframe
                src={video.src}
                title={lesson.title}
                className="size-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video src={video.src} controls className="size-full" />
            )}
          </div>
        )}
        <div className="p-8">
          <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>
          {/* Lesson HTML is sanitized when saved. */}
          <div
            className="zf-lesson mt-4 leading-7 text-zinc-700"
            dangerouslySetInnerHTML={{ __html: lesson.content }}
          />
          <div className="mt-8 flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-6">
            {prev && (
              <Link
                href={`/courses/${slug}/${prev.id}`}
                className="text-sm font-medium text-zinc-500 hover:text-zinc-900"
              >
                ← Previous
              </Link>
            )}
            <div className="flex-1" />
            {data.enrolled ? (
              <CompleteButton
                lessonId={lesson.id}
                done={lesson.done}
                nextHref={next ? `/courses/${slug}/${next.id}` : null}
              />
            ) : (
              next && (
                <Link href={`/courses/${slug}/${next.id}`} className="text-sm font-semibold text-indigo-600">
                  Next →
                </Link>
              )
            )}
          </div>
        </div>
      </article>
    </CourseShell>
  );
}
