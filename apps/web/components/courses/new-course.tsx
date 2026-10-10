"use client";

import { Button } from "@zfunnel/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@zfunnel/ui/dialog";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { useT } from "@zfunnel/i18n/react";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCourse } from "@/lib/course-actions";

export function NewCourse({ workspaceSlug, trigger }: { workspaceSlug: string; trigger: React.ReactNode }) {
  const router = useRouter();
  const t = useT();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("coursesAdmin.newCourse")}</DialogTitle>
          <DialogDescription>{t("coursesAdmin.newDialogDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const title = String(new FormData(e.currentTarget).get("title"));
            start(async () => {
              const r = await createCourse(workspaceSlug, title);
              if (!r.ok) return setError(r.error);
              router.push(`/${workspaceSlug}/courses/${r.id}`);
            });
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="course-title">{t("coursesAdmin.courseTitleLabel")}</Label>
            <Input
              id="course-title"
              name="title"
              placeholder={t("coursesAdmin.courseTitlePlaceholder")}
              required
              maxLength={120}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} {t("coursesAdmin.createCourse")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
