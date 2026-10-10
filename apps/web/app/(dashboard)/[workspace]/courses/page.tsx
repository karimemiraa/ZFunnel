import { Button } from "@zfunnel/ui/button";
import { EmptyState } from "@zfunnel/ui/empty-state";
import { BookOpenIcon, GraduationCapIcon, PlusIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { NewCourse } from "@/components/courses/new-course";
import { PageHeader } from "@/components/page-header";
import { requireWorkspace } from "@/lib/context";
import { listCourses } from "@/lib/courses";
import { siteOrigin } from "@/lib/urls";

export const metadata = { title: "Courses" };

export default async function CoursesPage({ params }: { params: Promise<{ workspace: string }> }) {
  const ctx = await requireWorkspace(params);
  const ws = ctx.workspace.slug;
  const list = await listCourses(ctx);
  const button = (
    <Button>
      <PlusIcon /> New course
    </Button>
  );
  return (
    <>
      <PageHeader
        title="Courses"
        description="Sell online courses and memberships. Buyers get instant access in their member area."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href={`${siteOrigin(ws)}/courses`} target="_blank" rel="noreferrer">
                Member area
              </a>
            </Button>
            <NewCourse workspaceSlug={ws} trigger={button} />
          </div>
        }
      />
      {list.length === 0 ? (
        <EmptyState
          icon={<GraduationCapIcon />}
          title="Create your first course"
          description="Organize lessons into modules, drip them out over time, and give access automatically when someone buys."
          action={<NewCourse workspaceSlug={ws} trigger={button} />}
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map(({ c, lessons, students }) => (
            <Link
              key={c.id}
              href={`/${ws}/courses/${c.id}`}
              className="group overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
            >
              <div className="flex aspect-[16/8] items-center justify-center bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" className="size-full object-cover" />
                ) : (
                  <GraduationCapIcon className="size-12 text-primary/60" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <h3 className="flex-1 truncate font-semibold group-hover:underline">{c.title}</h3>
                  <span
                    className={
                      c.status === "published"
                        ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
                        : "rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground"
                    }
                  >
                    {c.status === "published" ? "Published" : "Draft"}
                  </span>
                </div>
                <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <BookOpenIcon className="size-3.5" /> {lessons} lessons
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <UsersIcon className="size-3.5" /> {students} students
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
