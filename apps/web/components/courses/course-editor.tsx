"use client";

import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { cn } from "@zfunnel/ui/lib/utils";
import { NativeSelect } from "@zfunnel/ui/select";
import { Textarea } from "@zfunnel/ui/textarea";
import { toast } from "@zfunnel/ui/toaster";
import { useT } from "@zfunnel/i18n/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  FileTextIcon,
  Loader2Icon,
  LockIcon,
  PlayCircleIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFmt } from "@/lib/use-fmt";
import {
  addLesson,
  addModule,
  deleteLesson,
  deleteModule,
  enrollByEmail,
  moveItem,
  renameModule,
  saveCourseSettings,
  saveLesson,
  setEnrollmentAccess,
} from "@/lib/course-actions";

type Lesson = {
  id: string;
  title: string;
  videoUrl: string | null;
  content: string;
  dripDays: number;
  freePreview: boolean;
};
type Module = { id: string; title: string; lessons: Lesson[] };
type Student = {
  id: string;
  email: string;
  name: string | null;
  percent: number;
  revoked: boolean;
  source: string;
  since: string;
};
type Props = {
  workspaceSlug: string;
  course: {
    id: string;
    title: string;
    slug: string;
    description: string;
    imageUrl: string | null;
    status: "draft" | "published";
  };
  modules: Module[];
  productIds: string[];
  products: { id: string; name: string }[];
  students: Student[];
  publicUrl: string;
};

const SOURCES = { purchase: 1, manual: 1, automation: 1, api: 1 };
type Source = keyof typeof SOURCES;

function useRun() {
  const router = useRouter();
  const t = useT();
  const [pending, start] = useTransition();
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; message?: string; id?: string }>,
    after?: (r: { id?: string }) => void,
  ) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error ?? t("coursesAdmin.somethingWrong"));
      if (r.message) toast.success(r.message);
      after?.(r);
      router.refresh();
    });
  return { pending, run };
}

const htmlToText = (h: string) =>
  h
    .replace(/<\/p>\s*<p>/g, "\n\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<\/?p>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

function LessonPanel({
  ws,
  courseId,
  lesson,
  onClose,
}: {
  ws: string;
  courseId: string;
  lesson: Lesson;
  onClose: () => void;
}) {
  const { pending, run } = useRun();
  const t = useT();
  const rich = /<(?!\/?(p|br)\b)[a-z]/i.test(lesson.content);
  const [v, setV] = useState({
    title: lesson.title,
    videoUrl: lesson.videoUrl ?? "",
    content: rich ? lesson.content : htmlToText(lesson.content),
    dripDays: lesson.dripDays,
    freePreview: lesson.freePreview,
  });
  return (
    <form
      className="grid gap-4 rounded-xl border bg-card p-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveLesson(ws, courseId, lesson.id, v));
      }}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t("coursesAdmin.editLesson")}</h3>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("coursesAdmin.close")}
        </Button>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="l-title">{t("coursesAdmin.titleLabel")}</Label>
        <Input id="l-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} required />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="l-video">{t("coursesAdmin.videoLabel")}</Label>
        <Input
          id="l-video"
          dir="ltr"
          type="url"
          value={v.videoUrl}
          placeholder="https://"
          onChange={(e) => setV({ ...v, videoUrl: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="l-content">{t("coursesAdmin.lessonContent")}</Label>
        <Textarea
          id="l-content"
          rows={10}
          value={v.content}
          onChange={(e) => setV({ ...v, content: e.target.value })}
          placeholder={t("coursesAdmin.lessonPlaceholder")}
        />
        <p className="text-xs text-muted-foreground">{t("coursesAdmin.lessonHint")}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="l-drip">{t("coursesAdmin.unlockAfter")}</Label>
          <Input
            id="l-drip"
            type="number"
            min={0}
            max={3650}
            value={v.dripDays}
            onChange={(e) => setV({ ...v, dripDays: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
        <label className="flex items-end gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            className="size-4"
            checked={v.freePreview}
            onChange={(e) => setV({ ...v, freePreview: e.target.checked })}
          />
          {t("coursesAdmin.freePreview")}
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />} {t("coursesAdmin.saveLesson")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground hover:text-destructive"
          onClick={() =>
            confirm(t("coursesAdmin.confirmDeleteLesson")) && run(() => deleteLesson(ws, courseId, lesson.id), onClose)
          }
        >
          <Trash2Icon /> {t("coursesAdmin.delete")}
        </Button>
      </div>
    </form>
  );
}

function Curriculum({ p }: { p: Props }) {
  const { pending, run } = useRun();
  const t = useT();
  const [selected, setSelected] = useState<string | null>(null);
  const [newModule, setNewModule] = useState("");
  const lesson = p.modules.flatMap((m) => m.lessons).find((l) => l.id === selected);
  const ws = p.workspaceSlug;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <div className="grid content-start gap-4">
        {p.modules.map((m, mi) => (
          <section key={m.id} className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <span className="text-xs font-semibold text-muted-foreground">
                {t("coursesAdmin.moduleN", { n: mi + 1 })}
              </span>
              <input
                defaultValue={m.title}
                aria-label={t("coursesAdmin.moduleTitle")}
                className="min-w-0 flex-1 rounded bg-transparent px-1 py-0.5 font-semibold outline-none hover:bg-accent focus:bg-accent"
                onBlur={(e) =>
                  e.target.value.trim() &&
                  e.target.value !== m.title &&
                  run(() => renameModule(ws, m.id, e.target.value))
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={t("coursesAdmin.moveModuleUp")}
                disabled={mi === 0 || pending}
                onClick={() => run(() => moveItem(ws, p.course.id, "module", m.id, -1))}
              >
                <ArrowUpIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={t("coursesAdmin.moveModuleDown")}
                disabled={mi === p.modules.length - 1 || pending}
                onClick={() => run(() => moveItem(ws, p.course.id, "module", m.id, 1))}
              >
                <ArrowDownIcon />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 hover:text-destructive"
                aria-label={t("coursesAdmin.deleteModule")}
                onClick={() =>
                  confirm(t("coursesAdmin.confirmDeleteModule", { title: m.title })) &&
                  run(() => deleteModule(ws, p.course.id, m.id))
                }
              >
                <Trash2Icon />
              </Button>
            </div>
            <ul className="divide-y">
              {m.lessons.map((l, li) => (
                <li
                  key={l.id}
                  className={cn("flex items-center gap-2 px-4 py-2 text-sm", selected === l.id && "bg-primary/5")}
                >
                  {l.videoUrl ? (
                    <PlayCircleIcon className="size-4 text-primary" />
                  ) : (
                    <FileTextIcon className="size-4 text-muted-foreground" />
                  )}
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-start hover:underline"
                    onClick={() => setSelected(l.id)}
                  >
                    {l.title}
                  </button>
                  {l.freePreview && (
                    <span className="rounded bg-sky-500/15 px-1.5 text-[10px] font-semibold text-sky-700 dark:text-sky-400">
                      {t("coursesAdmin.previewBadge")}
                    </span>
                  )}
                  {l.dripDays > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <LockIcon className="size-3" /> {t("coursesAdmin.dayN", { n: l.dripDays })}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={t("coursesAdmin.moveLessonUp")}
                    disabled={li === 0 || pending}
                    onClick={() => run(() => moveItem(ws, p.course.id, "lesson", l.id, -1))}
                  >
                    <ArrowUpIcon className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6"
                    aria-label={t("coursesAdmin.moveLessonDown")}
                    disabled={li === m.lessons.length - 1 || pending}
                    onClick={() => run(() => moveItem(ws, p.course.id, "lesson", l.id, 1))}
                  >
                    <ArrowDownIcon className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={pending}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/5"
              onClick={() =>
                run(
                  () => addLesson(ws, p.course.id, m.id),
                  (r) => r.id && setSelected(r.id),
                )
              }
            >
              <PlusIcon className="size-4" /> {t("coursesAdmin.addLesson")}
            </button>
          </section>
        ))}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newModule.trim())
              run(
                () => addModule(ws, p.course.id, newModule),
                () => setNewModule(""),
              );
          }}
        >
          <Input
            value={newModule}
            onChange={(e) => setNewModule(e.target.value)}
            placeholder={t("coursesAdmin.newModuleName")}
            aria-label={t("coursesAdmin.newModuleName")}
          />
          <Button type="submit" variant="outline" disabled={pending || !newModule.trim()}>
            <PlusIcon /> {t("coursesAdmin.addModule")}
          </Button>
        </form>
      </div>
      <div className="lg:sticky lg:top-20 lg:self-start">
        {lesson ? (
          <LessonPanel
            key={lesson.id}
            ws={ws}
            courseId={p.course.id}
            lesson={lesson}
            onClose={() => setSelected(null)}
          />
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            {t("coursesAdmin.selectLesson")}
          </div>
        )}
      </div>
    </div>
  );
}

function Settings({ p }: { p: Props }) {
  const { pending, run } = useRun();
  const t = useT();
  const [v, setV] = useState({ ...p.course, imageUrl: p.course.imageUrl ?? "", productIds: p.productIds });
  return (
    <form
      className="grid max-w-2xl gap-5 rounded-xl border bg-card p-6"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => saveCourseSettings(p.workspaceSlug, p.course.id, v));
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="c-title">{t("coursesAdmin.titleLabel")}</Label>
        <Input id="c-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="c-slug">{t("coursesAdmin.url")}</Label>
        <div className="flex items-center gap-1 text-sm text-muted-foreground" dir="ltr">
          <span className="shrink-0">{p.publicUrl.replace(/\/[^/]+$/, "/")}</span>
          <Input id="c-slug" dir="ltr" value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="c-desc">{t("coursesAdmin.descriptionLabel")}</Label>
        <Textarea
          id="c-desc"
          rows={3}
          value={v.description}
          onChange={(e) => setV({ ...v, description: e.target.value })}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="c-img">{t("coursesAdmin.coverImage")}</Label>
        <Input
          id="c-img"
          dir="ltr"
          value={v.imageUrl}
          placeholder="https://"
          onChange={(e) => setV({ ...v, imageUrl: e.target.value })}
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">{t("coursesAdmin.productsAccess")}</legend>
        {p.products.length === 0 && <p className="text-sm text-muted-foreground">{t("coursesAdmin.noProducts")}</p>}
        {p.products.map((pr) => (
          <label key={pr.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={v.productIds.includes(pr.id)}
              onChange={(e) =>
                setV({
                  ...v,
                  productIds: e.target.checked ? [...v.productIds, pr.id] : v.productIds.filter((x) => x !== pr.id),
                })
              }
            />
            {pr.name}
          </label>
        ))}
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor="c-status">{t("coursesAdmin.status")}</Label>
        <NativeSelect
          id="c-status"
          value={v.status}
          onChange={(e) => setV({ ...v, status: e.target.value as "draft" | "published" })}
        >
          <option value="draft">{t("coursesAdmin.statusDraft")}</option>
          <option value="published">{t("coursesAdmin.statusPublished")}</option>
        </NativeSelect>
      </div>
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2Icon className="animate-spin" />} {t("coursesAdmin.saveSettings")}
        </Button>
      </div>
    </form>
  );
}

function Students({ p }: { p: Props }) {
  const { pending, run } = useRun();
  const t = useT();
  const f = useFmt();
  const [email, setEmail] = useState("");
  return (
    <div className="grid gap-4">
      <form
        className="flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => enrollByEmail(p.workspaceSlug, p.course.id, email),
            () => setEmail(""),
          );
        }}
      >
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="student@example.com"
          dir="ltr"
          aria-label={t("coursesAdmin.studentEmail")}
        />
        <Button type="submit" disabled={pending}>
          {t("coursesAdmin.enroll")}
        </Button>
      </form>
      {p.students.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {t("coursesAdmin.noStudents")}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">{t("coursesAdmin.colStudent")}</th>
                <th className="px-4 py-3">{t("coursesAdmin.colProgress")}</th>
                <th className="px-4 py-3 max-sm:hidden">{t("coursesAdmin.colJoined")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {p.students.map((s) => (
                <tr key={s.id} className={cn(s.revoked && "opacity-50")}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{s.name || s.email}</div>
                    {s.name && <div className="text-xs text-muted-foreground">{s.email}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${s.percent}%` }} />
                      </div>
                      <span className="text-xs tabular-nums">{s.percent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-sm:hidden">
                    {f.date(s.since)} ·{" "}
                    {s.source in SOURCES ? t(`coursesAdmin.sources.${s.source as Source}`) : s.source}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => run(() => setEnrollmentAccess(p.workspaceSlug, p.course.id, s.id, !s.revoked))}
                    >
                      {s.revoked ? t("coursesAdmin.restore") : t("coursesAdmin.removeAccess")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CourseEditor(p: Props & { tab: "curriculum" | "settings" | "students" }) {
  if (p.tab === "settings") return <Settings p={p} />;
  if (p.tab === "students") return <Students p={p} />;
  return <Curriculum p={p} />;
}
