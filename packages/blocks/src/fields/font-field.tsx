"use client";

import { FieldLabel } from "@puckeditor/core";

export type FontOption = { value: string; label: string; family: string; hint?: string };

/** Sample text shown in each option of the font picker, in the site's language. */
export const FONT_SAMPLES = { en: "The quick brown fox", ar: "خطٌّ جميل يُقرأ بسهولة" } as const;

/** Font picker for the Puck sidebar: every option previews itself in its own typeface. */
export function FontPicker({
  label,
  value,
  onChange,
  readOnly,
  options,
  sample,
  dir,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  options: FontOption[];
  sample: string;
  dir: "ltr" | "rtl";
}) {
  return (
    <FieldLabel label={label} readOnly={readOnly}>
      <div role="radiogroup" aria-label={label} style={{ display: "grid", gap: 4, maxHeight: 260, overflowY: "auto" }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={readOnly}
              onClick={() => onChange(o.value)}
              style={{
                display: "grid",
                gap: 2,
                textAlign: "start",
                padding: "6px 10px",
                borderRadius: 8,
                border: `1px solid ${active ? "#F28A22" : "#e4e4e7"}`,
                background: active ? "#fff7ee" : "#fff",
                cursor: readOnly ? "default" : "pointer",
              }}
            >
              <span style={{ fontSize: 11, color: "#71717a" }}>
                {o.label}
                {o.hint ? ` · ${o.hint}` : ""}
              </span>
              <span
                dir={dir}
                style={{
                  fontFamily: o.family,
                  fontSize: 17,
                  lineHeight: 1.5,
                  color: "#18181b",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                }}
              >
                {sample}
              </span>
            </button>
          );
        })}
      </div>
    </FieldLabel>
  );
}
