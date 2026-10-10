import { Button } from "@zfunnel/ui/button";
import { ArrowLeftIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourseEditor } from "@/components/courses/course-editor";
import { PageHeader } from "@/components/page-header";
import { listProducts } from "@/lib/commerce";
import { requireWorkspace } from "@/lib/context";
import { deleteCourse } from "@/lib/course-actions";
import { getCourseEditor, listStudents } from "@/lib/courses";
import { siteOrigin } from "@/lib/urls";

export const metadata = { title: "Course" };

export default async function CoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; courseId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await requireWorkspace(params);
  const { courseId } = await params;
  const { tab: rawTab } = await searchParams;
  const data = await getCourseEditor(ctx, courseId);
  if (!data) notFound();
  const tab = rawTab === "settings" || rawTab === "students" ? rawTab : "curriculum";
  const ws = ctx.workspace.slug;
  const [products, students] = await Promise.all([
    tab === "settings" ? listProducts(ctx) : Promise.resolve([]),
    tab === "students" ? listStudents(ctx, courseId, data.lessonCount) : Promise.resolve([]),
  ]);
  const base = `/${ws}/courses/${courseId}`;
  const publicUrl = `${siteOrigin(ws)}/courses/${data.course.slug}`;

  return (
    <>
      <Link
        href={`/${ws}/courses`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeftIcon className="size-4 rtl:-scale-x-100" /> Courses
      </Link>
      <PageHeader
        title={data.course.title}
        description={`${data.modules.length} modules · ${data.lessonCount} lessons · ${data.course.status === "published" ? "Published" : "Draft"}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLinkIcon /> View as student
              </a>
            </Button>
            <form action={deleteCourse.bind(null, ws, courseId)}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Delete course"
                className="hover:text-destructive"
              >
                <Trash2Icon />
              </Button>
            </form>
          </div>
        }
      />
      <nav className="mb-6 flex gap-1 border-b" aria-label="Course sections">
        {(["curriculum", "settings", "students"] as const).map((t) => (
          <Link
            key={t}
            href={t === "curriculum" ? base : `${base}?tab=${t}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize ${tab === t ? "border-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {t}
          </Link>
        ))}
      </nav>
      <CourseEditor
        tab={tab}
        workspaceSlug={ws}
        course={{
          id: data.course.id,
          title: data.course.title,
          slug: data.course.slug,
          description: data.course.description,
          imageUrl: data.course.imageUrl,
          status: data.course.status,
        }}
        modules={data.modules.map((m) => ({
          id: m.id,
          title: m.title,
          lessons: m.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            videoUrl: l.videoUrl,
            content: l.content,
            dripDays: l.dripDays,
            freePreview: l.freePreview,
          })),
        }))}
        productIds={data.productIds}
        products={products.map((p) => ({ id: p.id, name: p.name }))}
        students={students.map((s) => ({
          id: s.e.id,
          email: s.email,
          name: s.name,
          percent: s.percent,
          revoked: !!s.e.revokedAt,
          source: s.e.source,
          since: s.e.createdAt.toISOString(),
        }))}
        publicUrl={publicUrl}
      />
    </>
  );
}
