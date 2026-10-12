"use client";

import { useT } from "@zfunnel/i18n/react";
import { Button } from "@zfunnel/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@zfunnel/ui/dropdown-menu";
import { Loader2Icon, SparklesIcon } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { aiWrite } from "@/lib/ai-writer-actions";
import { isCopyField, WRITER_ACTIONS, type WriterAction } from "@/lib/ai-writer";

/** Live values for the AI writer, read by the field overrides (which must stay referentially stable). */
export const AiWriterContext = createContext<{ workspaceSlug: string; context: string } | null>(null);

type FieldProps = {
  children: ReactNode;
  name: string;
  value: unknown;
  onChange: (value: unknown) => void;
  field: { type: string; label?: string };
  readOnly?: boolean;
};

const plain = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Wraps a Puck text, textarea or rich-text field with the AI writer menu (platform admins only, 8.5j). */
function AiField({ children, name, value, onChange, field, readOnly }: FieldProps) {
  const ctx = useContext(AiWriterContext);
  const t = useT();
  const [busy, setBusy] = useState<WriterAction | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const text = typeof value === "string" ? value : "";
  const format = field.type === "richtext" ? "html" : "plain";
  const show = ctx && !readOnly && isCopyField(name) && plain(text).length > 0;

  async function run(action: WriterAction) {
    if (!ctx) return;
    setBusy(action);
    setError("");
    setResult(null);
    const r = await aiWrite(ctx.workspaceSlug, {
      action,
      format,
      text,
      field: field.label?.slice(0, 60),
      context: ctx.context,
    });
    setBusy(null);
    if (r.ok) setResult(r.text);
    else setError(r.error);
  }

  return (
    <div className="zf-ai-field relative" data-ai-field={name}>
      {show && (
        <div className="absolute end-0 top-0 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 text-brand-orange-text"
                aria-label={t("aiWriter.open")}
                disabled={!!busy}
              >
                {busy ? <Loader2Icon className="size-3.5 animate-spin" /> : <SparklesIcon className="size-3.5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs text-muted-foreground">{t("aiWriter.title")}</DropdownMenuLabel>
              {WRITER_ACTIONS.map((a) => (
                <DropdownMenuItem key={a} onClick={() => void run(a)}>
                  {t(`aiWriter.actions.${a}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
      {children}
      {busy && (
        <p className="mt-1 text-xs text-muted-foreground" role="status">
          {t("aiWriter.writing")}
        </p>
      )}
      {error && (
        <p className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {result !== null && (
        <div className="mt-2 grid gap-2 rounded-lg border border-brand-orange/40 bg-brand-orange/5 p-2.5">
          {format === "html" ? (
            <div className="text-sm [&_p]:mb-1.5" dangerouslySetInnerHTML={{ __html: result }} />
          ) : (
            <p className="text-sm whitespace-pre-line">{result}</p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onChange(result);
                setResult(null);
              }}
            >
              {t("aiWriter.use")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setResult(null)}>
              {t("aiWriter.discard")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Puck `overrides.fieldTypes` for the AI writer. Stable: create once at module load. */
export const AI_FIELD_TYPES = {
  text: AiField,
  textarea: AiField,
  richtext: AiField,
} as const;
