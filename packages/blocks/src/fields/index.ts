import type { CustomField } from "@puckeditor/core";
import { createElement } from "react";
import { ColorInput } from "./color-field";
import { FONT_SAMPLES, FontPicker, type FontOption } from "./font-field";

export { FONT_SAMPLES, type FontOption };

/** A font picker whose options preview in the site's language (Arabic sample text on Arabic sites). */
export function fontField<T extends string = string>(
  label: string,
  options: FontOption[],
  lang: "en" | "ar" = "en",
): CustomField<T> {
  const sample = FONT_SAMPLES[lang];
  const dir = lang === "ar" ? "rtl" : "ltr";
  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly }) =>
      createElement(FontPicker, { label, value, onChange: (v) => onChange(v as T), readOnly, options, sample, dir }),
  };
}

export function colorField(label: string): CustomField<string> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly }) => createElement(ColorInput, { label, value, onChange, readOnly }),
  };
}

export const alignField = {
  type: "radio" as const,
  label: "Alignment",
  options: [
    { label: "Left", value: "left" },
    { label: "Center", value: "center" },
    { label: "Right", value: "right" },
  ],
};

export const hideOnField = {
  type: "select" as const,
  label: "Visibility",
  options: [
    { label: "All devices", value: "none" },
    { label: "Hide on mobile", value: "mobile" },
    { label: "Hide on desktop", value: "desktop" },
  ],
};

export type Align = "left" | "center" | "right";
export type HideOn = "none" | "mobile" | "desktop";
