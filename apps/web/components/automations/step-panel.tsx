"use client";

import type { SegmentRule, WorkflowNode, WorkflowTrigger } from "@zfunnel/db/schema";
import { Button } from "@zfunnel/ui/button";
import { Input } from "@zfunnel/ui/input";
import { Label } from "@zfunnel/ui/label";
import { NativeSelect } from "@zfunnel/ui/select";
import { Textarea } from "@zfunnel/ui/textarea";
import { toast } from "@zfunnel/ui/toaster";
import { Loader2Icon, PaletteIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { createAutomationEmail, updateAutomationEmail } from "@/lib/automation-actions";
import { NODE_META, TRIGGER_CHOICES, TRIGGER_META, type Lookups } from "./meta";

function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TagInput({
  id,
  value,
  onChange,
  tags,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  tags: string[];
}) {
  return (
    <>
      <Input
        id={id}
        list={`${id}-tags`}
        value={value}
        maxLength={40}
        placeholder="e.g. customer"
        onChange={(e) => onChange(e.target.value)}
      />
      <datalist id={`${id}-tags`}>
        {tags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </>
  );
}

export function TriggerPanel({
  trigger,
  allowReentry,
  lookups,
  readOnly,
  onChange,
  onReentry,
}: {
  trigger: WorkflowTrigger;
  allowReentry: boolean;
  lookups: Lookups;
  readOnly: boolean;
  onChange: (t: WorkflowTrigger) => void;
  onReentry: (v: boolean) => void;
}) {
  return (
    <fieldset disabled={readOnly} className="grid gap-5">
      <Field label="Start this automation when a contact…" htmlFor="trigger-type">
        <NativeSelect
          id="trigger-type"
          value={trigger.type}
          onChange={(e) => {
            const t = e.target.value as WorkflowTrigger["type"];
            onChange(t === "tag_added" ? { type: t, tag: "" } : ({ type: t } as WorkflowTrigger));
          }}
        >
          {TRIGGER_CHOICES.map((t) => (
            <option key={t} value={t}>
              {TRIGGER_META[t].label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {(trigger.type === "optin" || trigger.type === "form_submitted") && (
        <Field label="Funnel" htmlFor="trigger-funnel">
          <NativeSelect
            id="trigger-funnel"
            value={trigger.funnelId ?? ""}
            onChange={(e) => onChange({ type: trigger.type, funnelId: e.target.value || null } as WorkflowTrigger)}
          >
            <option value="">Any funnel</option>
            {lookups.funnels.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {trigger.type === "purchase" && (
        <Field label="Product" htmlFor="trigger-product">
          <NativeSelect
            id="trigger-product"
            value={trigger.productId ?? ""}
            onChange={(e) => onChange({ type: "purchase", productId: e.target.value || null })}
          >
            <option value="">Any product</option>
            {lookups.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {trigger.type === "booked" && (
        <Field label="Calendar" htmlFor="trigger-calendar">
          <NativeSelect
            id="trigger-calendar"
            value={trigger.calendarId ?? ""}
            onChange={(e) => onChange({ type: "booked", calendarId: e.target.value || null })}
          >
            <option value="">Any calendar</option>
            {lookups.calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {(trigger.type === "webinar_registered" || trigger.type === "webinar_attended") && (
        <Field label="Webinar" htmlFor="trigger-webinar">
          <NativeSelect
            id="trigger-webinar"
            value={trigger.webinarId ?? ""}
            onChange={(e) => onChange({ type: trigger.type, webinarId: e.target.value || null })}
          >
            <option value="">Any webinar</option>
            {lookups.webinars.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
              </option>
            ))}
          </NativeSelect>
        </Field>
      )}
      {trigger.type === "tag_added" && (
        <Field label="Tag" htmlFor="trigger-tag">
          <TagInput
            id="trigger-tag"
            value={trigger.tag}
            tags={lookups.tags}
            onChange={(tag) => onChange({ type: "tag_added", tag })}
          />
        </Field>
      )}
      {trigger.type === "manual" && (
        <p className="text-sm text-muted-foreground">Open any contact and choose “Add to automation”.</p>
      )}
      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-[var(--primary)]"
          checked={allowReentry}
          onChange={(e) => onReentry(e.target.checked)}
        />
        <span>
          <span className="font-medium">Allow contacts to re-enter</span>
          <span className="block text-xs text-muted-foreground">
            Off: each contact goes through this automation once.
          </span>
        </span>
      </label>
    </fieldset>
  );
}

type RuleKind = "tag_has" | "tag_not" | "customer" | "not_customer" | "email" | "custom";
function ruleKind(r: SegmentRule | null): RuleKind {
  if (!r) return "tag_has";
  if (r.field === "tag") return r.op === "has" ? "tag_has" : "tag_not";
  if (r.field === "customer") return r.op === "is" ? "customer" : "not_customer";
  if (r.field === "email") return "email";
  return "custom";
}

function EmailStep({
  node,
  lookups,
  workspaceSlug,
  workflowId,
  onChange,
  onEmailsChange,
  readOnly,
}: StepProps & { node: Extract<WorkflowNode, { type: "send_email" }> }) {
  const email = lookups.emails.find((e) => e.id === node.emailId);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const edit = (patch: Partial<NonNullable<typeof email>>) => {
    if (!email) return;
    const next = { ...email, ...patch };
    onEmailsChange(lookups.emails.map((e) => (e.id === email.id ? next : e)));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const r = await updateAutomationEmail(workspaceSlug, email.id, next);
      if (!r.ok) toast.error(r.error);
    }, 500);
  };
  return (
    <div className="grid gap-5">
      <Field label="Email" htmlFor="node-email">
        <div className="flex gap-2">
          <div className="flex-1">
            <NativeSelect
              id="node-email"
              disabled={readOnly}
              value={node.emailId ?? ""}
              onChange={(e) => onChange({ ...node, emailId: e.target.value || null })}
            >
              <option value="">Choose an email…</option>
              {lookups.emails.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.subject || e.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="New email"
            disabled={pending || readOnly}
            onClick={() =>
              start(async () => {
                const r = await createAutomationEmail(workspaceSlug);
                if (!r.ok || !r.id) return void toast.error(r.ok ? "Failed" : r.error);
                onEmailsChange([{ id: r.id, name: "Automation email", subject: "", preheader: "" }, ...lookups.emails]);
                onChange({ ...node, emailId: r.id });
              })
            }
          >
            {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
          </Button>
        </div>
      </Field>
      {email && (
        <>
          <Field label="Subject line" htmlFor="node-subject" hint="Personalize with {{first_name|there}}.">
            <Input
              id="node-subject"
              value={email.subject}
              onChange={(e) => edit({ subject: e.target.value })}
              placeholder="Welcome aboard, {{first_name|friend}}!"
            />
          </Field>
          <Field label="Preview text" htmlFor="node-preheader">
            <Input id="node-preheader" value={email.preheader} onChange={(e) => edit({ preheader: e.target.value })} />
          </Field>
          <div className="overflow-hidden rounded-lg border">
            <iframe
              title="Email preview"
              src={`/email-preview/${workspaceSlug}/${email.id}`}
              className="h-64 w-full bg-white"
              sandbox="allow-same-origin"
            />
          </div>
          <Button asChild>
            <Link href={`/email-editor/${workspaceSlug}/${email.id}?w=${workflowId}`}>
              <PaletteIcon /> Design email
            </Link>
          </Button>
        </>
      )}
    </div>
  );
}

type StepProps = {
  node: WorkflowNode;
  lookups: Lookups;
  workspaceSlug: string;
  workflowId: string;
  readOnly: boolean;
  onChange: (n: WorkflowNode) => void;
  onEmailsChange: (emails: Lookups["emails"]) => void;
};

export function StepPanel(props: StepProps & { onDelete: () => void; onClose: () => void }) {
  const { node, lookups, onChange, readOnly } = props;
  const m = NODE_META[node.type];
  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg text-white" style={{ background: m.color }}>
          <m.icon className="size-[18px]" />
        </span>
        <div className="flex-1">
          <h2 className="text-sm font-semibold">{m.label}</h2>
          <p className="text-xs text-muted-foreground">{m.hint}</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={props.onClose}>
          <XIcon />
        </Button>
      </div>

      {node.type === "send_email" && <EmailStep {...props} node={node} />}

      {node.type === "wait" && (
        <fieldset disabled={readOnly} className="grid grid-cols-[1fr_1.4fr] gap-2">
          <Field label="Wait for" htmlFor="wait-amount">
            <Input
              id="wait-amount"
              type="number"
              min={1}
              max={365}
              value={node.amount}
              onChange={(e) => onChange({ ...node, amount: Math.min(365, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </Field>
          <Field label="Unit" htmlFor="wait-unit">
            <NativeSelect
              id="wait-unit"
              value={node.unit}
              onChange={(e) => onChange({ ...node, unit: e.target.value as typeof node.unit })}
            >
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </NativeSelect>
          </Field>
        </fieldset>
      )}

      {(node.type === "add_tag" || node.type === "remove_tag") && (
        <fieldset disabled={readOnly}>
          <Field label="Tag" htmlFor="node-tag">
            <TagInput
              id="node-tag"
              value={node.tag}
              tags={lookups.tags}
              onChange={(tag) => onChange({ ...node, tag })}
            />
          </Field>
        </fieldset>
      )}

      {node.type === "condition" && (
        <ConditionFields node={node} lookups={lookups} readOnly={readOnly} onChange={onChange} />
      )}

      {node.type === "send_sms" && (
        <fieldset disabled={readOnly}>
          <Field
            label="Message"
            htmlFor="node-sms"
            hint={`${node.message.length} characters · ${Math.max(1, Math.ceil(node.message.length / 160))} SMS. Use {{first_name|there}} to personalize.`}
          >
            <Textarea
              id="node-sms"
              rows={5}
              maxLength={1600}
              value={node.message}
              onChange={(e) => onChange({ ...node, message: e.target.value })}
            />
          </Field>
        </fieldset>
      )}

      {node.type === "grant_course" && (
        <fieldset disabled={readOnly}>
          <Field label="Course" htmlFor="node-course" hint="The contact gets instant access in the member area.">
            <NativeSelect
              id="node-course"
              value={node.courseId ?? ""}
              onChange={(e) => onChange({ ...node, courseId: e.target.value || null })}
            >
              <option value="">Choose a course…</option>
              {lookups.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </fieldset>
      )}

      {node.type === "webhook" && (
        <fieldset disabled={readOnly}>
          <Field
            label="URL"
            htmlFor="node-url"
            hint="We POST JSON with the contact's email, name, tags and custom fields. Zapier, Make and n8n webhooks work."
          >
            <Input
              id="node-url"
              type="url"
              value={node.url}
              placeholder="https://hooks.zapier.com/…"
              onChange={(e) => onChange({ ...node, url: e.target.value })}
            />
          </Field>
        </fieldset>
      )}

      {!readOnly && (
        <Button
          variant="ghost"
          className="justify-start text-muted-foreground hover:text-destructive"
          onClick={props.onDelete}
        >
          <Trash2Icon /> Delete step
        </Button>
      )}
    </div>
  );
}

function ConditionFields({
  node,
  lookups,
  readOnly,
  onChange,
}: {
  node: Extract<WorkflowNode, { type: "condition" }>;
  lookups: Lookups;
  readOnly: boolean;
  onChange: (n: WorkflowNode) => void;
}) {
  const kind = ruleKind(node.rule);
  const r = node.rule;
  const value = r && "value" in r ? String(r.value ?? "") : "";
  const set = (rule: SegmentRule | null) => onChange({ ...node, rule });
  const build = (k: RuleKind, v = value, key = r?.field === "custom" ? r.key : ""): SegmentRule | null => {
    switch (k) {
      case "tag_has":
      case "tag_not":
        return v ? { field: "tag", op: k === "tag_has" ? "has" : "not_has", value: v } : null;
      case "customer":
        return { field: "customer", op: "is" };
      case "not_customer":
        return { field: "customer", op: "is_not" };
      case "email":
        return v ? { field: "email", op: "contains", value: v } : null;
      case "custom":
        return key ? { field: "custom", key, op: v ? "equals" : "is_set", value: v || undefined } : null;
    }
  };
  const [k, setK] = useState<RuleKind>(kind);
  return (
    <fieldset disabled={readOnly} className="grid gap-4">
      <Field label="Contact…" htmlFor="cond-kind">
        <NativeSelect
          id="cond-kind"
          value={k}
          onChange={(e) => {
            const nk = e.target.value as RuleKind;
            setK(nk);
            set(build(nk));
          }}
        >
          <option value="tag_has">Has tag</option>
          <option value="tag_not">Doesn't have tag</option>
          <option value="customer">Is a customer</option>
          <option value="not_customer">Is not a customer</option>
          <option value="email">Email contains</option>
          <option value="custom">Custom field</option>
        </NativeSelect>
      </Field>
      {(k === "tag_has" || k === "tag_not") && (
        <Field label="Tag" htmlFor="cond-tag">
          <TagInput id="cond-tag" value={value} tags={lookups.tags} onChange={(v) => set(build(k, v))} />
        </Field>
      )}
      {k === "email" && (
        <Field label="Text" htmlFor="cond-email">
          <Input
            id="cond-email"
            value={value}
            placeholder="@gmail.com"
            onChange={(e) => set(build(k, e.target.value))}
          />
        </Field>
      )}
      {k === "custom" && (
        <>
          <Field label="Field key" htmlFor="cond-key">
            <Input
              id="cond-key"
              value={r?.field === "custom" ? r.key : ""}
              placeholder="company"
              onChange={(e) => set(build(k, value, e.target.value))}
            />
          </Field>
          <Field label="Equals (leave empty for “is set”)" htmlFor="cond-val">
            <Input id="cond-val" value={value} onChange={(e) => set(build(k, e.target.value))} />
          </Field>
        </>
      )}
      <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
        Contacts who match continue on <strong className="text-emerald-600">Yes</strong>, everyone else on{" "}
        <strong className="text-rose-600">No</strong>.
      </p>
    </fieldset>
  );
}
