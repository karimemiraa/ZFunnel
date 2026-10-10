"use client";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, Loader2Icon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { parseOptions, questionKey, type Answers, type Question } from "../survey";
import { cx } from "../utils";

type Props = {
  blockId: string;
  questions: Question[];
  askEmail: boolean;
  askName: boolean;
  display: "steps" | "all";
  buttonLabel: string;
  successMessage: string;
  live: boolean;
  stepId?: string;
  apiBase: string;
};

const input =
  "h-13 w-full min-w-0 rounded-[var(--zf-radius)] border px-4 text-base outline-none transition focus:ring-4 bg-[var(--zf-bg)] text-[var(--zf-text)] border-[color-mix(in_srgb,var(--zf-text)_18%,transparent)] focus:border-[var(--zf-primary)] focus:ring-[color-mix(in_srgb,var(--zf-primary)_20%,transparent)]";
const primaryBtn = {
  borderRadius: "var(--zf-btn-radius)",
  background: "var(--zf-primary)",
  color: "var(--zf-on-primary)",
  boxShadow: "0 10px 30px -10px color-mix(in srgb, var(--zf-primary) 70%, transparent)",
} as const;

function Choice({
  letter,
  label,
  selected,
  multi,
  onClick,
}: {
  letter: string;
  label: string;
  selected: boolean;
  multi: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-3 rounded-[var(--zf-radius)] border px-4 py-3.5 text-left text-base transition-all hover:-translate-y-px",
        selected
          ? "border-[var(--zf-primary)] bg-[color-mix(in_srgb,var(--zf-primary)_10%,transparent)]"
          : "border-[color-mix(in_srgb,var(--zf-text)_15%,transparent)] hover:border-[color-mix(in_srgb,var(--zf-primary)_60%,transparent)]",
      )}
    >
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold"
        style={
          selected
            ? { background: "var(--zf-primary)", color: "var(--zf-on-primary)", borderColor: "var(--zf-primary)" }
            : { borderColor: "color-mix(in srgb, var(--zf-text) 25%, transparent)" }
        }
      >
        {selected ? <CheckIcon className="size-4" /> : letter}
      </span>
      <span className="flex-1 font-medium">{label}</span>
    </button>
  );
}

function QuestionInput({
  q,
  k,
  value,
  onChange,
  onEnter,
}: {
  q: Question;
  k: string;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  onEnter?: () => void;
}) {
  const opts = parseOptions(q.options);
  if (q.type === "single_choice" || q.type === "multiple_choice") {
    const multi = q.type === "multiple_choice";
    const arr = Array.isArray(value) ? value : value ? [value] : [];
    return (
      <div className="grid gap-2" role={multi ? "group" : "radiogroup"} aria-label={q.label}>
        {opts.map((o, i) => (
          <Choice
            key={o.label}
            letter={String.fromCharCode(65 + i)}
            label={o.label}
            multi={multi}
            selected={arr.includes(o.label)}
            onClick={() =>
              onChange(multi ? (arr.includes(o.label) ? arr.filter((x) => x !== o.label) : [...arr, o.label]) : o.label)
            }
          />
        ))}
      </div>
    );
  }
  if (q.type === "dropdown")
    return (
      <select
        className={input}
        aria-label={q.label}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Choose…</option>
        {opts.map((o) => (
          <option key={o.label}>{o.label}</option>
        ))}
      </select>
    );
  if (q.type === "long_text")
    return (
      <textarea
        className={cx(input, "h-32 py-3")}
        aria-label={q.label}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  return (
    <input
      className={input}
      aria-label={q.label}
      id={k}
      type={q.type === "email" ? "email" : q.type === "phone" ? "tel" : q.type === "number" ? "number" : "text"}
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && onEnter) {
          e.preventDefault();
          onEnter();
        }
      }}
    />
  );
}

export function SurveyView(p: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  const [contact, setContact] = useState({ email: "", name: "" });
  const [step, setStep] = useState(0);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<string | null>(null);
  const qs = p.questions ?? [];
  const contactStep = p.askEmail;
  const total = qs.length + (contactStep ? 1 : 0);
  const steps = p.display === "steps";

  const missing = (i: number) => {
    const q = qs[i];
    if (!q?.required) return false;
    const v = answers[questionKey(i)];
    return Array.isArray(v) ? !v.length : !String(v ?? "").trim();
  };

  async function submit() {
    if (!p.live) return setError("Forms submit on your published page, not in the editor.");
    for (let i = 0; i < qs.length; i++) if (missing(i)) return setError(`Please answer: ${qs[i]!.label}`);
    setState("sending");
    setError("");
    try {
      const res = await fetch(`${p.apiBase}/form`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          stepId: p.stepId,
          blockId: p.blockId,
          answers,
          email: contact.email || undefined,
          name: contact.name || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { redirect?: string; outcome?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Please try again.");
      if (json.redirect) return window.location.assign(json.redirect);
      setOutcome(json.outcome ?? null);
      setState("done");
    } catch (err) {
      setState("idle");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const next = () => {
    if (step < qs.length && missing(step)) return setError("Please answer this question to continue.");
    setError("");
    if (step + 1 >= total) return void submit();
    setStep(step + 1);
  };

  if (state === "done")
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center" role="status">
        <span
          className="flex size-14 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--zf-primary) 15%, transparent)", color: "var(--zf-primary)" }}
        >
          {outcome ? <SparklesIcon className="size-7" /> : <CheckIcon className="size-7" />}
        </span>
        {outcome ? (
          <>
            <p className="text-sm font-semibold tracking-wider uppercase opacity-60">Your result</p>
            <p className="text-3xl font-bold" style={{ fontFamily: "var(--zf-heading-font)" }}>
              {outcome}
            </p>
          </>
        ) : (
          <p className="text-xl font-semibold">{p.successMessage}</p>
        )}
      </div>
    );

  if (!qs.length)
    return (
      <div className="rounded-[var(--zf-radius)] border border-dashed p-8 text-center opacity-60">
        Add questions in the panel on the right →
      </div>
    );

  const contactFields = (
    <div className="grid gap-3">
      {p.askName && (
        <input
          className={input}
          placeholder="Your first name"
          aria-label="Name"
          autoComplete="name"
          value={contact.name}
          onChange={(e) => setContact({ ...contact, name: e.target.value })}
        />
      )}
      <input
        className={input}
        type="email"
        placeholder="Your best email"
        aria-label="Email"
        autoComplete="email"
        required
        value={contact.email}
        onChange={(e) => setContact({ ...contact, email: e.target.value })}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), next())}
      />
    </div>
  );

  const submitBtn = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "sending"}
      className="inline-flex min-h-13 items-center justify-center gap-2 px-7 text-lg font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-70"
      style={primaryBtn}
    >
      {state === "sending" && <Loader2Icon className="size-5 animate-spin" />}
      {label}
      {state !== "sending" && <ArrowRightIcon className="size-5" />}
    </button>
  );

  if (!steps)
    return (
      <form className="mx-auto grid w-full max-w-xl gap-7" onSubmit={(e) => (e.preventDefault(), void submit())}>
        {qs.map((q, i) => (
          <div key={i} className="grid gap-3">
            <p className="text-lg font-semibold">
              {q.label}
              {q.required && <span style={{ color: "var(--zf-primary)" }}> *</span>}
            </p>
            <QuestionInput
              q={q}
              k={questionKey(i)}
              value={answers[questionKey(i)]}
              onChange={(v) => setAnswers({ ...answers, [questionKey(i)]: v })}
            />
          </div>
        ))}
        {contactStep && contactFields}
        {error && (
          <p role="alert" className="text-sm font-medium text-red-500">
            {error}
          </p>
        )}
        {submitBtn(p.buttonLabel, () => void submit())}
      </form>
    );

  const q = qs[step];
  const pct = Math.round((step / total) * 100);
  return (
    <div className="mx-auto w-full max-w-xl">
      <div
        className="mb-6 h-1.5 overflow-hidden rounded-full"
        style={{ background: "color-mix(in srgb, var(--zf-text) 10%, transparent)" }}
        aria-hidden
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, 4)}%`, background: "var(--zf-primary)" }}
        />
      </div>
      <div key={step} className="zf-fade-in grid gap-4">
        <p className="text-sm font-semibold opacity-60">
          {step + 1} / {total}
        </p>
        {q ? (
          <>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--zf-heading-font)" }}>
              {q.label}
              {q.required && <span style={{ color: "var(--zf-primary)" }}> *</span>}
            </p>
            <QuestionInput
              q={q}
              k={questionKey(step)}
              value={answers[questionKey(step)]}
              onEnter={next}
              onChange={(v) => {
                setAnswers({ ...answers, [questionKey(step)]: v });
                setError("");
                // Single choice: advance automatically for a snappy, Typeform-like feel.
                if (q.type === "single_choice")
                  setTimeout(() => setStep((s) => (s === step && s + 1 < total ? s + 1 : s)), 280);
              }}
            />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold" style={{ fontFamily: "var(--zf-heading-font)" }}>
              Where should we send your results?
            </p>
            {contactFields}
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-500">
          {error}
        </p>
      )}
      <div className="mt-6 flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => (setError(""), setStep(step - 1))}
            className="inline-flex h-11 items-center gap-1.5 px-3 text-sm font-medium opacity-70 hover:opacity-100"
          >
            <ArrowLeftIcon className="size-4" /> Back
          </button>
        )}
        <div className="flex-1" />
        {submitBtn(step + 1 >= total ? p.buttonLabel : "Next", next)}
      </div>
    </div>
  );
}
