"use client";

import { Badge } from "@zfunnel/ui/badge";
import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { NativeSelect } from "@zfunnel/ui/select";
import { Textarea } from "@zfunnel/ui/textarea";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addNote, deleteContact, setTags, updateContact } from "@/lib/crm-actions";

type Field = { key: string; label: string; type: string; options: string[] | null };

export function ContactProfile({
  workspaceSlug,
  contact,
  fields,
  canDelete,
}: {
  workspaceSlug: string;
  contact: { id: string; name: string | null; phone: string | null; tags: string[]; fields: Record<string, unknown> };
  fields: Field[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [newTag, setNewTag] = useState("");
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? msg);
        router.refresh();
      } else toast.error(r.error ?? "Something went wrong");
    });

  return (
    <div className="space-y-6">
      <form
        className="space-y-4 rounded-xl border bg-card p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const values = Object.fromEntries(
            fields.map((fd) => [
              fd.key,
              fd.type === "checkbox" ? f.get(`f_${fd.key}`) === "on" : String(f.get(`f_${fd.key}`) ?? "") || null,
            ]),
          );
          run(
            () =>
              updateContact(workspaceSlug, contact.id, {
                name: String(f.get("name") ?? ""),
                phone: String(f.get("phone") ?? ""),
                fields: values,
              }),
            "Saved",
          );
        }}
      >
        <h2 className="font-semibold">Details</h2>
        <div className="space-y-1.5">
          <Label htmlFor="p-name">Name</Label>
          <Input id="p-name" name="name" defaultValue={contact.name ?? ""} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="p-phone">Phone</Label>
          <Input id="p-phone" name="phone" defaultValue={contact.phone ?? ""} />
        </div>
        {fields.map((fd) => {
          const v = contact.fields?.[fd.key];
          const id = `f_${fd.key}`;
          return (
            <div key={fd.key} className="space-y-1.5">
              <Label htmlFor={id}>{fd.label}</Label>
              {fd.type === "select" ? (
                <NativeSelect id={id} name={id} defaultValue={String(v ?? "")}>
                  <option value="">—</option>
                  {(fd.options ?? []).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </NativeSelect>
              ) : fd.type === "checkbox" ? (
                <input
                  id={id}
                  name={id}
                  type="checkbox"
                  defaultChecked={Boolean(v)}
                  className="block size-4 accent-primary"
                />
              ) : (
                <Input
                  id={id}
                  name={id}
                  type={
                    fd.type === "number" ? "number" : fd.type === "date" ? "date" : fd.type === "url" ? "url" : "text"
                  }
                  defaultValue={String(v ?? "")}
                />
              )}
            </div>
          );
        })}
        <Button type="submit" variant="secondary" disabled={busy} className="w-full">
          {busy && <Loader2Icon className="animate-spin" />} Save details
        </Button>
      </form>

      <div className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Tags</h2>
        <div className="flex flex-wrap gap-1.5">
          {contact.tags.length === 0 && <span className="text-sm text-muted-foreground">No tags yet</span>}
          {contact.tags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1 pr-1">
              {t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                className="rounded-full p-0.5 hover:text-foreground"
                onClick={() => run(() => setTags(workspaceSlug, [contact.id], t, "remove"), "Tag removed")}
              >
                <XIcon />
              </button>
            </Badge>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setTags(workspaceSlug, [contact.id], newTag, "add"), "Tag added");
            setNewTag("");
          }}
        >
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Add a tag"
            aria-label="New tag"
            className="h-8"
          />
          <Button size="sm" type="submit" disabled={!newTag || busy}>
            <PlusIcon />
          </Button>
        </form>
      </div>

      {canDelete && (
        <Button
          variant="ghost"
          className="w-full text-destructive hover:text-destructive"
          onClick={() =>
            confirm(
              "Permanently delete this contact and their history (GDPR erasure)? Orders are kept without personal data.",
            ) && start(() => deleteContact(workspaceSlug, contact.id))
          }
        >
          <Trash2Icon /> Delete contact (GDPR)
        </Button>
      )}
    </div>
  );
}

export function NoteForm({ workspaceSlug, contactId }: { workspaceSlug: string; contactId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, start] = useTransition();
  return (
    <form
      className="space-y-2 rounded-xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addNote(workspaceSlug, contactId, text);
          if (r.ok) {
            setText("");
            router.refresh();
          } else toast.error(r.error);
        });
      }}
    >
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a note…"
        rows={2}
        aria-label="Note"
      />
      <div className="flex justify-end">
        <Button size="sm" type="submit" disabled={!text.trim() || busy}>
          {busy && <Loader2Icon className="animate-spin" />} Add note
        </Button>
      </div>
    </form>
  );
}
