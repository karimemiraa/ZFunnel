"use client";

import { Button } from "@zfunnel/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@zfunnel/ui/dialog";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { NativeSelect } from "@zfunnel/ui/select";
import { toast } from "@zfunnel/ui/toaster";
import { useT } from "@zfunnel/i18n/react";
import { DownloadIcon, Loader2Icon, PlusIcon, SlidersHorizontalIcon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addField, createContact, deleteField, importContacts } from "@/lib/crm-actions";

function useAction() {
  const t = useT();
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
      } else toast.error(r.error ?? t("contacts.somethingWrong"));
    });
  return { busy, run };
}

export function AddContactDialog({ workspaceSlug }: { workspaceSlug: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon /> {t("contacts.addContact")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("contacts.addAContact")}</DialogTitle>
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
              t("contacts.contactAdded"),
              () => setOpen(false),
            );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="c-email">{t("contacts.email")}</Label>
            <Input id="c-email" name="email" type="email" dir="ltr" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-name">{t("contacts.name")}</Label>
              <Input id="c-name" name="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-phone">{t("contacts.phone")}</Label>
              <Input id="c-phone" name="phone" dir="ltr" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="c-tags">{t("contacts.tagsComma")}</Label>
            <Input id="c-tags" name="tags" placeholder={t("contacts.tagsPlaceholder")} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy && <Loader2Icon className="animate-spin" />} {t("contacts.addContact")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ImportDialog({ workspaceSlug }: { workspaceSlug: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [tag, setTag] = useState("");
  const { busy, run } = useAction();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UploadIcon /> {t("contacts.import")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("contacts.importTitle")}</DialogTitle>
          <DialogDescription>{t("contacts.importDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-sm hover:border-primary/50">
            <UploadIcon className="size-6 text-muted-foreground" />
            {file ? (
              <span className="font-medium">{file.name}</span>
            ) : (
              <span className="text-muted-foreground">{t("contacts.chooseCsv")}</span>
            )}
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <div className="space-y-2">
            <Label htmlFor="imp-tag">{t("contacts.importTag")}</Label>
            <Input
              id="imp-tag"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder={t("contacts.importTagPlaceholder")}
            />
          </div>
          <div className="flex justify-end">
            <Button
              disabled={busy || !file}
              onClick={() =>
                file &&
                run(
                  async () => importContacts(workspaceSlug, await file.text(), tag || undefined),
                  t("contacts.imported"),
                  () => setOpen(false),
                )
              }
            >
              {busy && <Loader2Icon className="animate-spin" />} {t("contacts.importContacts")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ExportButton({ href }: { href: string }) {
  const t = useT();
  return (
    <Button variant="outline" asChild>
      <a href={href}>
        <DownloadIcon /> {t("contacts.export")}
      </a>
    </Button>
  );
}

type Field = { id: string; label: string; key: string; type: string };
const FIELD_TYPES = ["text", "number", "date", "select", "checkbox", "url"] as const;
type FieldType = (typeof FIELD_TYPES)[number];
export function FieldsDialog({ workspaceSlug, fields }: { workspaceSlug: string; fields: Field[] }) {
  const t = useT();
  const { busy, run } = useAction();
  const [type, setType] = useState("text");
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost">
          <SlidersHorizontalIcon /> {t("contacts.fields")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("contacts.customFields")}</DialogTitle>
          <DialogDescription>
            {t("contacts.customFieldsDescription")} <span dir="ltr">{"{{field_key}}"}</span>.
          </DialogDescription>
        </DialogHeader>
        {fields.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {fields.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 font-medium">{f.label}</span>
                <code className="text-xs text-muted-foreground">{f.key}</code>
                <span className="text-xs text-muted-foreground">{t(`contacts.fieldType.${f.type as FieldType}`)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={t("contacts.deleteFieldAria", { label: f.label })}
                  onClick={() =>
                    confirm(t("contacts.deleteFieldConfirm", { label: f.label })) &&
                    run(() => deleteField(workspaceSlug, f.id), t("contacts.fieldDeleted"))
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
              t("contacts.fieldAdded"),
              () => form.reset(),
            );
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="f-label">{t("contacts.newField")}</Label>
            <Input id="f-label" name="label" placeholder={t("contacts.newFieldPlaceholder")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="f-type">{t("contacts.type")}</Label>
            <NativeSelect id="f-type" value={type} onChange={(e) => setType(e.target.value)}>
              {FIELD_TYPES.map((ft) => (
                <option key={ft} value={ft}>
                  {t(`contacts.fieldType.${ft}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" disabled={busy}>
            {t("contacts.add")}
          </Button>
          {type === "select" && (
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="f-options">{t("contacts.optionsComma")}</Label>
              <Input id="f-options" name="options" placeholder={t("contacts.optionsPlaceholder")} />
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
