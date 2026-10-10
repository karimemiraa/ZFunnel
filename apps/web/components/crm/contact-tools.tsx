"use client";

import { Button } from "@zfunnel/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@zfunnel/ui/dialog";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { NativeSelect } from "@zfunnel/ui/select";
import { toast } from "@zfunnel/ui/toaster";
import { DownloadIcon, Loader2Icon, PlusIcon, SlidersHorizontalIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addField, createContact, deleteField, importContacts } from "@/lib/crm-actions";

function useAction() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; message?: string }>,
    success: string,
    after?: () => void,
  ) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? success);
        after?.();
        router.refresh();
      } else toast.error(r.error ?? "Something went wrong");
    });
  return { busy, run };
}

export function AddContactDialog({ workspaceSlug }: { workspaceSlug: string }) {
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon /> Add contact
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a contact</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            run(
              () =>
                createContact(workspaceSlug, {
                  email: String(f.get("email")),
                  name: String(f.get("name") ?? ""),
                  phone: String(f.get("phone") ?? ""),
                  tags: String(f.get("tags") ?? "")
                    .split(",")
                    .filter(Boolean),
                }),
              "Contact added",
              () => setOpen(false),
            );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" name="email" type="email" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-name">Name</Label>
              <Input id="c-name" name="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-phone">Phone</Label>
              <Input id="c-phone" name="phone" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-tags">Tags (comma separated)</Label>
            <Input id="c-tags" name="tags" placeholder="vip, webinar" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" />} Add contact
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ImportDialog({ workspaceSlug }: { workspaceSlug: string }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [tag, setTag] = useState("");
  const { busy, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UploadIcon /> Import
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import contacts from CSV</DialogTitle>
          <DialogDescription>
            Needs an “email” column. Optional: name, phone, tags (separated by |). Existing contacts are updated, never
            duplicated.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-sm hover:border-primary/50">
            <UploadIcon className="size-6 text-muted-foreground" />
            {file ? (
              <span className="font-medium">{file.name}</span>
            ) : (
              <span className="text-muted-foreground">Choose a .csv file</span>
            )}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="space-y-2">
            <Label htmlFor="imp-tag">Tag everyone in this file (optional)</Label>
            <Input id="imp-tag" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="imported-oct" />
          </div>
          <div className="flex justify-end">
            <Button
              disabled={busy || !file}
              onClick={() =>
                file &&
                run(
                  async () => importContacts(workspaceSlug, await file.text(), tag || undefined),
                  "Imported",
                  () => setOpen(false),
                )
              }
            >
              {busy && <Loader2Icon className="animate-spin" />} Import contacts
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ExportButton({ href }: { href: string }) {
  return (
    <Button variant="outline" asChild>
      <a href={href}>
        <DownloadIcon /> Export
      </a>
    </Button>
  );
}

type Field = { id: string; label: string; key: string; type: string };
export function FieldsDialog({ workspaceSlug, fields }: { workspaceSlug: string; fields: Field[] }) {
  const { busy, run } = useAction();
  const [type, setType] = useState("text");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost">
          <SlidersHorizontalIcon /> Fields
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom fields</DialogTitle>
          <DialogDescription>
            Store anything about your contacts: company, birthday, plan… Usable in segments and emails as{" "}
            {"{{field_key}}"}.
          </DialogDescription>
        </DialogHeader>
        {fields.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {fields.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 font-medium">{f.label}</span>
                <code className="text-xs text-muted-foreground">{f.key}</code>
                <span className="text-xs text-muted-foreground">{f.type}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Delete ${f.label}`}
                  onClick={() =>
                    confirm(`Delete field “${f.label}”?`) &&
                    run(() => deleteField(workspaceSlug, f.id), "Field deleted")
                  }
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="grid gap-3 sm:grid-cols-[1fr_130px_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const form = e.currentTarget;
            run(
              () =>
                addField(workspaceSlug, {
                  label: String(f.get("label")),
                  type: type as never,
                  options: String(f.get("options") ?? ""),
                }),
              "Field added",
              () => form.reset(),
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="f-label">New field</Label>
            <Input id="f-label" name="label" placeholder="Company" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-type">Type</Label>
            <NativeSelect id="f-type" value={type} onChange={(e) => setType(e.target.value)}>
              {["text", "number", "date", "select", "checkbox", "url"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" disabled={busy}>
            Add
          </Button>
          {type === "select" && (
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="f-options">Options (comma separated)</Label>
              <Input id="f-options" name="options" placeholder="Starter, Pro, Agency" />
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
