"use client";

import { FieldLabel } from "@puckeditor/core";

const SWATCHES = [
  "#4f46e5",
  "#7c3aed",
  "#db2777",
  "#e11d48",
  "#ea580c",
  "#f59e0b",
  "#059669",
  "#0891b2",
  "#0f172a",
  "#ffffff",
];

/** Colour picker field for the Puck sidebar: swatches + native picker + hex input. */
export function ColorInput({
  label,
  value,
  onChange,
  readOnly,
}: {
  label?: string;
  value?: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const v = value || "#000000";
  return (
    <FieldLabel label={label ?? "Color"} readOnly={readOnly}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="color"
            value={v}
            disabled={readOnly}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: 36,
              height: 32,
              border: "1px solid #e4e4e7",
              borderRadius: 8,
              padding: 2,
              background: "#fff",
            }}
            aria-label={`${label ?? "Color"} picker`}
          />
          <input
            type="text"
            value={value ?? ""}
            disabled={readOnly}
            placeholder="#000000"
            onChange={(e) => onChange(e.target.value)}
            style={{
              flex: 1,
              height: 32,
              border: "1px solid #e4e4e7",
              borderRadius: 8,
              padding: "0 10px",
              fontFamily: "ui-monospace, monospace",
              fontSize: 13,
            }}
          />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {SWATCHES.map((s) => (
            <button
              key={s}
              type="button"
              title={s}
              disabled={readOnly}
              onClick={() => onChange(s)}
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                background: s,
                border: s.toLowerCase() === v.toLowerCase() ? "2px solid #111" : "1px solid #d4d4d8",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      </div>
    </FieldLabel>
  );
}
