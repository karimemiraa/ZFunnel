import type { ComponentConfig } from "@puckeditor/core";
import { getRuntime } from "../runtime";
import { CountdownView } from "./countdown-view";
import { parseOptions, type Outcome, type Question } from "../survey";
import { OptInFormView } from "./optin-form-view";
import { SurveyView } from "./survey-view";

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
  render: ({ id, puck, ...p }) => <CountdownView {...p} storageKey={id} lang={getRuntime(puck.metadata).lang} />,
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
        lang={rt.lang}
      />
    );
  },
};

export type SurveyProps = {
  formName: string;
  questions: Question[];
  display: "steps" | "all";
  askEmail: boolean;
  askName: boolean;
  buttonLabel: string;
  successMessage: string;
  tag: string;
  quiz: boolean;
  outcomes: Outcome[];
};

const yesNo = [
  { label: "No", value: false },
  { label: "Yes", value: true },
];

export const Survey: ComponentConfig<SurveyProps> = {
  label: "Form / survey / quiz",
  fields: {
    formName: { type: "text", label: "Form name (shown in your dashboard)" },
    questions: {
      type: "array",
      label: "Questions",
      max: 30,
      getItemSummary: (q) => q.label || "Question",
      defaultItemProps: {
        label: "New question",
        type: "single_choice",
        required: true,
        options: "Option A\nOption B",
        saveTo: "",
      },
      arrayFields: {
        label: { type: "text", label: "Question" },
        type: {
          type: "select",
          label: "Answer type",
          options: [
            { label: "Single choice", value: "single_choice" },
            { label: "Multiple choice", value: "multiple_choice" },
            { label: "Dropdown", value: "dropdown" },
            { label: "Short text", value: "short_text" },
            { label: "Long text", value: "long_text" },
            { label: "Email", value: "email" },
            { label: "Phone", value: "phone" },
            { label: "Number", value: "number" },
          ],
        },
        options: { type: "textarea", label: "Options (one per line; quiz points: “Option | 3”)" },
        required: { type: "radio", label: "Required", options: yesNo },
        saveTo: { type: "text", label: "Save answer to contact field (name, phone or a custom field key)" },
      },
    },
    display: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "One question at a time", value: "steps" },
        { label: "All on one page", value: "all" },
      ],
    },
    askEmail: { type: "radio", label: "Ask for email (creates a contact)", options: yesNo },
    askName: { type: "radio", label: "Ask for name", options: yesNo },
    buttonLabel: { type: "text", label: "Submit button" },
    successMessage: { type: "text", label: "Thank-you message (if there is no next step)" },
    tag: { type: "text", label: "Tag everyone who submits" },
    quiz: { type: "radio", label: "Quiz scoring", options: yesNo },
    outcomes: {
      type: "array",
      label: "Quiz results (highest matching score wins)",
      getItemSummary: (o) => `${o.minScore}+ → ${o.title || "Result"}`,
      defaultItemProps: { minScore: 0, title: "Your result", tag: "", redirect: "" },
      arrayFields: {
        minScore: { type: "number", label: "Minimum score" },
        title: { type: "text", label: "Result title" },
        tag: { type: "text", label: "Tag to add" },
        redirect: { type: "text", label: "Send to URL (optional)" },
      },
    },
  },
  resolveFields: (data, { fields }) => ({
    ...fields,
    askName: { ...fields.askName, visible: data.props.askEmail },
    outcomes: { ...fields.outcomes, visible: data.props.quiz },
  }),
  defaultProps: {
    formName: "Survey",
    questions: [
      {
        label: "What's your main goal right now?",
        type: "single_choice",
        required: true,
        options: "Get more leads\nIncrease sales\nLaunch a new product",
        saveTo: "goal",
      },
      {
        label: "How big is your business?",
        type: "single_choice",
        required: true,
        options: "Just me\n2–10 people\n11+ people",
        saveTo: "",
      },
    ],
    display: "steps",
    askEmail: true,
    askName: true,
    buttonLabel: "See my results",
    successMessage: "Thanks! We've got your answers.",
    tag: "",
    quiz: false,
    outcomes: [],
  },
  render: ({ puck, id, formName: _f, tag: _t, quiz: _q, outcomes: _o, ...p }) => {
    const rt = getRuntime(puck.metadata);
    // Quiz points stay on the server: the browser only gets option labels.
    const questions = (p.questions ?? []).map((q) => ({
      ...q,
      options: parseOptions(q.options)
        .map((o) => o.label)
        .join("\n"),
    }));
    return (
      <SurveyView
        {...p}
        questions={questions}
        blockId={id}
        live={rt.mode === "live"}
        stepId={rt.stepId}
        apiBase={rt.apiBase ?? "/api"}
        lang={rt.lang}
      />
    );
  },
};
