import type { ComponentConfig } from "@puckeditor/core";
import { getRuntime } from "../runtime";
import { CountdownView } from "./countdown-view";
import { OptInFormView } from "./optin-form-view";

export type CountdownProps = {
  mode: "date" | "evergreen";
  date: string;
  minutes: number;
  style: "boxes" | "inline";
  expiredText: string;
};
export const Countdown: ComponentConfig<CountdownProps> = {
  label: "Countdown timer",
  fields: {
    mode: {
      type: "radio",
      label: "Type",
      options: [
        { label: "Fixed date", value: "date" },
        { label: "Evergreen", value: "evergreen" },
      ],
    },
    date: { type: "text", label: "Ends at (e.g. 2026-12-31T23:59)" },
    minutes: { type: "number", label: "Minutes per visitor", min: 1, max: 60 * 24 * 30 },
    style: {
      type: "radio",
      label: "Style",
      options: [
        { label: "Boxes", value: "boxes" },
        { label: "Inline", value: "inline" },
      ],
    },
    expiredText: { type: "text", label: "Text when expired" },
  },
  resolveFields: (data, { fields }) => ({
    ...fields,
    date: { ...fields.date, visible: data.props.mode === "date" },
    minutes: { ...fields.minutes, visible: data.props.mode === "evergreen" },
  }),
  defaultProps: { mode: "evergreen", date: "", minutes: 15, style: "boxes", expiredText: "This offer has expired." },
  render: ({ id, ...p }) => <CountdownView {...p} storageKey={id} />,
};

export type OptInFormProps = {
  askName: boolean;
  askPhone: boolean;
  buttonLabel: string;
  privacyNote: string;
  layout: "stacked" | "inline";
  successMessage: string;
};
export const OptInForm: ComponentConfig<OptInFormProps> = {
  label: "Opt-in form",
  fields: {
    askName: {
      type: "radio",
      label: "Ask for name",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    askPhone: {
      type: "radio",
      label: "Ask for phone",
      options: [
        { label: "No", value: false },
        { label: "Yes", value: true },
      ],
    },
    buttonLabel: { type: "text", label: "Button label" },
    privacyNote: { type: "text", label: "Privacy note" },
    layout: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "Stacked", value: "stacked" },
        { label: "Single row", value: "inline" },
      ],
    },
    successMessage: { type: "text", label: "Message if there is no next step" },
  },
  defaultProps: {
    askName: true,
    askPhone: false,
    buttonLabel: "Send me the free guide",
    privacyNote: "We respect your privacy. Unsubscribe anytime.",
    layout: "stacked",
    successMessage: "Thanks! Check your inbox.",
  },
  render: ({ puck, id: _id, ...p }) => {
    const rt = getRuntime(puck.metadata);
    return (
      <OptInFormView
        {...p}
        live={rt.mode === "live"}
        stepId={rt.stepId}
        apiBase={rt.apiBase ?? "/api"}
        nextUrl={rt.nextUrl}
      />
    );
  },
};
