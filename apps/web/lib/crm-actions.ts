"use server";

import {
  and,
  asc,
  contactActivities,
  contactFields,
  contacts,
  eq,
  inArray,
  opportunities,
  pipelines,
  pipelineStages,
  segments,
  sql,
  type SegmentRule,
  type Tx,
} from "@zfunnel/db";
import { parseCsv, slugify } from "@zfunnel/shared";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { inWorkspace } from "./funnels";
import { requireUser } from "./session";
import { canManage, getWorkspaceForUser, recordAudit } from "./workspaces";

type Result = { ok: true; message?: string; id?: string } | { ok: false; error: string };

async function ctxFor(workspaceSlug: string) {
  const user = await requireUser();
  const ctx = await getWorkspaceForUser(user.id, workspaceSlug);
  if (!ctx) throw new Error("Workspace not found");
  return { user, ctx };
}
const uuid = z.string().uuid();
const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(40)
  .regex(/^[\p{L}\p{N} _-]+$/u, "Letters, numbers, spaces, - and _ only");

async function activity(
  tx: Tx,
  workspaceId: string,
  contactId: string,
  type: "note" | "tag_added" | "tag_removed" | "deal_moved",
  body: string | null,
  actorUserId: string,
  data?: Record<string, unknown>,
) {
  await tx.insert(contactActivities).values({ workspaceId, contactId, type, body, actorUserId, data });
}

// ---------- Contacts ----------

const contactSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
});

export async function createContact(
  workspaceSlug: string,
  input: { email: string; name?: string; phone?: string; tags?: string[] },
): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };
  const tags = (input.tags ?? []).map((t) => tagSchema.safeParse(t)).flatMap((r) => (r.success ? [r.data] : []));
  const id = await inWorkspace(ctx, async (tx) => {
    const [c] = await tx
      .insert(contacts)
      .values({
        workspaceId: ctx.workspace.id,
        email: parsed.data.email,
        name: parsed.data.name || null,
        phone: parsed.data.phone || null,
        tags,
      })
      .onConflictDoNothing()
      .returning({ id: contacts.id });
    return c?.id ?? null;
  });
  if (!id) return { ok: false, error: "A contact with this email already exists." };
  await recordAudit(ctx, user.id, { action: "contact.created", entityType: "contact", entityId: id });
  revalidatePath(`/${workspaceSlug}/contacts`);
  return { ok: true, id };
}

export async function updateContact(
  workspaceSlug: string,
  contactId: string,
  input: { name?: string; phone?: string; fields?: Record<string, string | number | boolean | null> },
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  if (!uuid.safeParse(contactId).success) return { ok: false, error: "Invalid contact" };
  await inWorkspace(ctx, async (tx) => {
    const defs = await tx.select().from(contactFields);
    const allowed = new Set(defs.map((d) => d.key));
    const fields = Object.fromEntries(
      Object.entries(input.fields ?? {})
        .filter(([k]) => allowed.has(k))
        .map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 500) : v]),
    );
    await tx
      .update(contacts)
      .set({
        ...(input.name !== undefined ? { name: input.name.trim().slice(0, 120) || null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone.trim().slice(0, 40) || null } : {}),
        ...(input.fields ? { fields: sql`${contacts.fields} || ${JSON.stringify(fields)}::jsonb` } : {}),
      })
      .where(eq(contacts.id, contactId));
  });
  revalidatePath(`/${workspaceSlug}/contacts/${contactId}`);
  return { ok: true, message: "Saved" };
}

export async function setTags(
  workspaceSlug: string,
  contactIds: string[],
  tag: string,
  mode: "add" | "remove",
): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const t = tagSchema.safeParse(tag);
  if (!t.success) return { ok: false, error: t.error.issues[0]!.message };
  const ids = contactIds.filter((id) => uuid.safeParse(id).success).slice(0, 5000);
  if (!ids.length) return { ok: false, error: "No contacts selected" };
  await inWorkspace(ctx, async (tx) => {
    const changed = await tx
      .update(contacts)
      .set({
        tags:
          mode === "add"
            ? sql`case when ${t.data} = any(${contacts.tags}) then ${contacts.tags} else array_append(${contacts.tags}, ${t.data}) end`
            : sql`array_remove(${contacts.tags}, ${t.data})`,
      })
      .where(
        and(
          inArray(contacts.id, ids),
          mode === "add" ? sql`not (${t.data} = any(${contacts.tags}))` : sql`${t.data} = any(${contacts.tags})`,
        ),
      )
      .returning({ id: contacts.id });
    if (changed.length)
      await tx
        .insert(contactActivities)
        .values(
          changed.map((c) => ({
            workspaceId: ctx.workspace.id,
            contactId: c.id,
            type: mode === "add" ? ("tag_added" as const) : ("tag_removed" as const),
            body: t.data,
            actorUserId: user.id,
          })),
        );
  });
  revalidatePath(`/${workspaceSlug}/contacts`, "layout");
  return {
    ok: true,
    message: `${mode === "add" ? "Tagged" : "Untagged"} ${ids.length} contact${ids.length === 1 ? "" : "s"}`,
  };
}

export async function addNote(workspaceSlug: string, contactId: string, body: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const text = body.trim().slice(0, 5000);
  if (!text || !uuid.safeParse(contactId).success) return { ok: false, error: "Write a note first" };
  await inWorkspace(ctx, async (tx) => {
    const [c] = await tx.select({ id: contacts.id }).from(contacts).where(eq(contacts.id, contactId));
    if (c) await activity(tx, ctx.workspace.id, contactId, "note", text, user.id);
  });
  revalidatePath(`/${workspaceSlug}/contacts/${contactId}`);
  return { ok: true };
}

/** GDPR erasure: deletes the contact and their timeline. Orders stay (accounting) but lose the link. */
export async function deleteContact(workspaceSlug: string, contactId: string) {
  const { user, ctx } = await ctxFor(workspaceSlug);
  if (!canManage(ctx.membership.role)) throw new Error("Only owners and admins can delete contacts.");
  await inWorkspace(ctx, (tx) => tx.delete(contacts).where(eq(contacts.id, contactId)));
  await recordAudit(ctx, user.id, { action: "contact.deleted", entityType: "contact", entityId: contactId });
  revalidatePath(`/${workspaceSlug}/contacts`);
  redirect(`/${workspaceSlug}/contacts`);
}

export async function importContacts(workspaceSlug: string, csvText: string, tag?: string): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  if (csvText.length > 5_000_000) return { ok: false, error: "File too large (5 MB max)" };
  const rows = parseCsv(csvText);
  if (rows.length < 2) return { ok: false, error: "The file needs a header row and at least one contact." };
  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h));
  const iEmail = col("email", "e-mail", "email address");
  if (iEmail < 0) return { ok: false, error: "No “email” column found in the header row." };
  const iName = col("name", "full name", "first name");
  const iPhone = col("phone", "phone number", "mobile");
  const iTags = col("tags", "tag");
  const extraTag = tag ? tagSchema.safeParse(tag) : null;
  const seen = new Set<string>();
  const values = rows.slice(1).flatMap((r) => {
    const email = z.string().trim().toLowerCase().email().safeParse(r[iEmail]);
    if (!email.success || seen.has(email.data)) return [];
    seen.add(email.data);
    const tags = [...(iTags >= 0 ? (r[iTags] ?? "").split(/[|,]/) : []), ...(extraTag?.success ? [extraTag.data] : [])]
      .map((t) => tagSchema.safeParse(t))
      .flatMap((x) => (x.success ? [x.data] : []));
    return [
      {
        workspaceId: ctx.workspace.id,
        email: email.data,
        name: iName >= 0 ? r[iName]?.trim().slice(0, 120) || null : null,
        phone: iPhone >= 0 ? r[iPhone]?.trim().slice(0, 40) || null : null,
        tags: [...new Set(tags)],
      },
    ];
  });
  if (!values.length) return { ok: false, error: "No valid email addresses found." };
  let created = 0;
  await inWorkspace(ctx, async (tx) => {
    for (let i = 0; i < values.length; i += 500) {
      const res = await tx
        .insert(contacts)
        .values(values.slice(i, i + 500))
        .onConflictDoUpdate({
          target: [contacts.workspaceId, contacts.email],
          set: {
            name: sql`coalesce(${contacts.name}, excluded.name)`,
            phone: sql`coalesce(${contacts.phone}, excluded.phone)`,
            tags: sql`(select array(select distinct unnest(${contacts.tags} || excluded.tags)))`,
          },
        })
        .returning({ inserted: sql<boolean>`xmax = 0` });
      created += res.filter((r) => r.inserted).length;
    }
  });
  await recordAudit(ctx, user.id, {
    action: "contacts.imported",
    entityType: "contact",
    data: { rows: values.length, created },
  });
  revalidatePath(`/${workspaceSlug}/contacts`);
  return {
    ok: true,
    message: `Imported ${values.length} contacts (${created} new, ${values.length - created} updated).`,
  };
}

// ---------- Custom fields & segments ----------

export async function addField(
  workspaceSlug: string,
  input: { label: string; type: "text" | "number" | "date" | "select" | "checkbox" | "url"; options?: string },
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const label = input.label.trim().slice(0, 60);
  if (!label) return { ok: false, error: "Give the field a name" };
  const key = slugify(label).replace(/-/g, "_") || "field";
  const options =
    input.type === "select"
      ? (input.options ?? "")
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean)
          .slice(0, 50)
      : null;
  try {
    await inWorkspace(ctx, async (tx) => {
      const [{ n }] = (await tx.select({ n: sql<number>`count(*)::int` }).from(contactFields)) as [{ n: number }];
      await tx
        .insert(contactFields)
        .values({ workspaceId: ctx.workspace.id, key, label, type: input.type, options, position: n });
    });
  } catch {
    return { ok: false, error: "A field with this name already exists" };
  }
  revalidatePath(`/${workspaceSlug}/contacts`, "layout");
  return { ok: true };
}

export async function deleteField(workspaceSlug: string, fieldId: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.delete(contactFields).where(eq(contactFields.id, fieldId)));
  revalidatePath(`/${workspaceSlug}/contacts`, "layout");
  return { ok: true };
}

const ruleSchema: z.ZodType<SegmentRule> = z.union([
  z.object({ field: z.literal("tag"), op: z.enum(["has", "not_has"]), value: z.string().min(1).max(40) }),
  z.object({ field: z.enum(["email", "name"]), op: z.literal("contains"), value: z.string().min(1).max(100) }),
  z.object({
    field: z.literal("created"),
    op: z.enum(["within_days", "older_than_days"]),
    value: z.number().int().min(1).max(3650),
  }),
  z.object({ field: z.literal("customer"), op: z.enum(["is", "is_not"]) }),
  z.object({ field: z.literal("source_funnel"), op: z.literal("is"), value: z.string().uuid() }),
  z.object({
    field: z.literal("custom"),
    key: z.string().min(1).max(60),
    op: z.enum(["equals", "contains", "is_set"]),
    value: z.string().max(100).optional(),
  }),
]);

export async function saveSegment(
  workspaceSlug: string,
  input: { id?: string; name: string; match: "all" | "any"; rules: unknown[] },
): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const rules = z.array(ruleSchema).min(1, "Add at least one rule").max(20).safeParse(input.rules);
  if (!rules.success) return { ok: false, error: rules.error.issues[0]!.message };
  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Name the segment" };
  const id = await inWorkspace(ctx, async (tx) => {
    if (input.id) {
      await tx.update(segments).set({ name, match: input.match, rules: rules.data }).where(eq(segments.id, input.id));
      return input.id;
    }
    const [s] = await tx
      .insert(segments)
      .values({ workspaceId: ctx.workspace.id, name, match: input.match, rules: rules.data })
      .returning();
    return s!.id;
  });
  revalidatePath(`/${workspaceSlug}/contacts`, "layout");
  return { ok: true, id };
}

export async function deleteSegment(workspaceSlug: string, segmentId: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.delete(segments).where(eq(segments.id, segmentId)));
  revalidatePath(`/${workspaceSlug}/contacts`, "layout");
  return { ok: true };
}

// ---------- Pipelines & deals ----------

const DEFAULT_STAGES: [string, string, "open" | "won" | "lost"][] = [
  ["New lead", "#6366f1", "open"],
  ["Contacted", "#0ea5e9", "open"],
  ["Proposal sent", "#f59e0b", "open"],
  ["Won", "#10b981", "won"],
  ["Lost", "#94a3b8", "lost"],
];

export async function createPipeline(workspaceSlug: string, name: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const n = name.trim().slice(0, 60) || "Sales pipeline";
  const id = await inWorkspace(ctx, async (tx) => {
    const [p] = await tx.insert(pipelines).values({ workspaceId: ctx.workspace.id, name: n }).returning();
    await tx
      .insert(pipelineStages)
      .values(
        DEFAULT_STAGES.map(([sn, color, kind], i) => ({
          workspaceId: ctx.workspace.id,
          pipelineId: p!.id,
          name: sn,
          color,
          kind,
          position: i,
        })),
      );
    return p!.id;
  });
  revalidatePath(`/${workspaceSlug}/pipelines`);
  return { ok: true, id };
}

export async function addStage(workspaceSlug: string, pipelineId: string, name: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  const n = name.trim().slice(0, 40);
  if (!n) return { ok: false, error: "Name the stage" };
  await inWorkspace(ctx, async (tx) => {
    const stages = await tx
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, pipelineId))
      .orderBy(asc(pipelineStages.position));
    // New open stages go before the won/lost columns.
    const firstClosed = stages.findIndex((s) => s.kind !== "open");
    const pos = firstClosed < 0 ? stages.length : firstClosed;
    for (const s of stages.slice(pos))
      await tx
        .update(pipelineStages)
        .set({ position: s.position + 1 })
        .where(eq(pipelineStages.id, s.id));
    await tx.insert(pipelineStages).values({ workspaceId: ctx.workspace.id, pipelineId, name: n, position: pos });
  });
  revalidatePath(`/${workspaceSlug}/pipelines`);
  return { ok: true };
}

const dealSchema = z.object({
  pipelineId: uuid,
  stageId: uuid,
  title: z.string().trim().min(1, "Give the deal a title").max(120),
  value: z.number().int().min(0).max(1_000_000_000),
  contactEmail: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
});

export async function createDeal(workspaceSlug: string, input: z.input<typeof dealSchema>): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  const d = dealSchema.safeParse(input);
  if (!d.success) return { ok: false, error: d.error.issues[0]!.message };
  const res = await inWorkspace(ctx, async (tx) => {
    const [stage] = await tx
      .select()
      .from(pipelineStages)
      .where(and(eq(pipelineStages.id, d.data.stageId), eq(pipelineStages.pipelineId, d.data.pipelineId)));
    if (!stage) return "Stage not found";
    let contactId: string | null = null;
    if (d.data.contactEmail) {
      const [c] = await tx
        .insert(contacts)
        .values({ workspaceId: ctx.workspace.id, email: d.data.contactEmail })
        .onConflictDoUpdate({ target: [contacts.workspaceId, contacts.email], set: { updatedAt: new Date() } })
        .returning({ id: contacts.id });
      contactId = c!.id;
    }
    await tx.insert(opportunities).values({
      workspaceId: ctx.workspace.id,
      pipelineId: d.data.pipelineId,
      stageId: stage.id,
      title: d.data.title,
      value: d.data.value,
      contactId,
      ownerUserId: user.id,
      closedAt: stage.kind === "open" ? null : new Date(),
    });
    return null;
  });
  if (res) return { ok: false, error: res };
  revalidatePath(`/${workspaceSlug}/pipelines`);
  return { ok: true };
}

export async function moveDeal(
  workspaceSlug: string,
  dealId: string,
  stageId: string,
  beforeDealId: string | null,
): Promise<Result> {
  const { user, ctx } = await ctxFor(workspaceSlug);
  if (![dealId, stageId].every((x) => uuid.safeParse(x).success)) return { ok: false, error: "Invalid move" };
  const err = await inWorkspace(ctx, async (tx) => {
    const [deal] = await tx.select().from(opportunities).where(eq(opportunities.id, dealId));
    const [stage] = await tx.select().from(pipelineStages).where(eq(pipelineStages.id, stageId));
    if (!deal || !stage || stage.pipelineId !== deal.pipelineId) return "Can't move there";
    const siblings = (
      await tx
        .select({ id: opportunities.id })
        .from(opportunities)
        .where(eq(opportunities.stageId, stageId))
        .orderBy(asc(opportunities.position))
    )
      .map((r) => r.id)
      .filter((id) => id !== dealId);
    const at = beforeDealId ? siblings.indexOf(beforeDealId) : -1;
    siblings.splice(at < 0 ? siblings.length : at, 0, dealId);
    for (const [i, id] of siblings.entries())
      await tx
        .update(opportunities)
        .set(
          id === dealId
            ? { stageId, position: i, closedAt: stage.kind === "open" ? null : (deal.closedAt ?? new Date()) }
            : { position: i },
        )
        .where(eq(opportunities.id, id));
    if (deal.stageId !== stageId && deal.contactId)
      await activity(tx, ctx.workspace.id, deal.contactId, "deal_moved", `${deal.title} → ${stage.name}`, user.id, {
        dealId,
        stageId,
      });
    return null;
  });
  if (err) return { ok: false, error: err };
  revalidatePath(`/${workspaceSlug}/pipelines`);
  return { ok: true };
}

export async function deleteDeal(workspaceSlug: string, dealId: string): Promise<Result> {
  const { ctx } = await ctxFor(workspaceSlug);
  await inWorkspace(ctx, (tx) => tx.delete(opportunities).where(eq(opportunities.id, dealId)));
  revalidatePath(`/${workspaceSlug}/pipelines`);
  return { ok: true };
}
