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
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCourse } from "@/lib/course-actions";

export function NewCourse({ workspaceSlug, trigger }: { workspaceSlug: string; trigger: React.ReactNode }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New course</DialogTitle>
          <DialogDescription>We'll add a first module and a welcome lesson to get you started.</DialogDescription>
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
            <Label htmlFor="course-title">Course title</Label>
            <Input id="course-title" name="title" placeholder="e.g. Funnel Mastery" required maxLength={120} />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />} Create course
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
