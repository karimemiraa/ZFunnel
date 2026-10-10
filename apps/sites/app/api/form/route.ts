import { findBlock, pickOutcome, scoreAnswers, validateAnswers, type SurveyDef } from "@zfunnel/blocks/survey";
import { contacts, eq, formSubmissions, inArray, or, pageVersions, sql, stepVariants } from "@zfunnel/db";
import { logActivity, system } from "@zfunnel/payments";
import { enqueue, enqueueMany } from "@zfunnel/queue";
import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError, publicPost } from "@/lib/api";
import { resolveStepForWorkspace } from "@/lib/resolve";
import { track } from "@/lib/track";
import { conversionContext } from "@/lib/conversion-context";

const bodySchema = z.object({
  stepId: z.string().uuid(),
  blockId: z.string().min(1).max(100),
  answers: z.record(z.string().max(10), z.union([z.string().max(5000), z.array(z.string().max(500)).max(30)])),
  email: z.string().trim().toLowerCase().max(254).optional(),
  name: z.string().trim().max(120).optional(),
});

const FIELD_KEY = /^[a-z][a-z0-9_]{0,39}$/;
const safeRedirect = (u: string) => (/^https?:\/\/[^\s]+$/i.test(u.trim()) ? u.trim() : null);

/** Form / survey / quiz submissions. The definition (and quiz scoring) comes from the published page. */
export async function POST(req: Request) {
  const g = await publicPost(req, "form", 15);
  if ("error" in g) return g.error;
  const parsed = bodySchema.safeParse(g.body);
  if (!parsed.success) return jsonError("errors.invalidForm");
  const { stepId, blockId, answers, name } = parsed.data;

  const step = await resolveStepForWorkspace(g.ws.id, stepId);
  if (!step) return jsonError("errors.formUnavailable", 404);
  // The form can live on the original page or on a split-test variant.
  const versions = await system((tx) =>
    tx
      .select({ data: pageVersions.data })
      .from(pageVersions)
      .where(
        or(
          eq(pageVersions.id, step.published!),
          inArray(
            pageVersions.id,
            tx
              .select({ id: sql<string>`${stepVariants.publishedVersionId}` })
              .from(stepVariants)
              .where(eq(stepVariants.stepId, step.id)),
          ),
        ),
      ),
  );
  const block = versions.map((v) => findBlock(v.data, blockId)).find(Boolean) ?? null;
  if (!block || block.type !== "Survey") return jsonError("errors.formUnavailable", 404);
  const def = block.props as unknown as SurveyDef;

  const checked = validateAnswers(def, answers);
  if (!checked.ok) return jsonError(checked.error);
  const email = parsed.data.email ?? "";
  if (def.askEmail && !z.string().email().safeParse(email).success) return jsonError("errors.invalidEmail");

  const score = def.quiz ? scoreAnswers(def, checked.answers) : null;
  const outcome = def.quiz && score !== null ? pickOutcome(def, score) : null;
  const tags = [def.tag, outcome?.tag].map((t) => (t ?? "").trim().slice(0, 40)).filter(Boolean);

  // Answers mapped to contact fields.
  let contactName = name || null;
  let phone: string | null = null;
  const fields: Record<string, string> = {};
  for (const a of checked.answers) {
    const v = Array.isArray(a.value) ? a.value.join(", ") : a.value;
    const to = a.saveTo.trim().toLowerCase();
    if (to === "name") contactName ??= v.slice(0, 120);
    else if (to === "phone") phone = v.slice(0, 40);
    else if (FIELD_KEY.test(to)) fields[to] = v.slice(0, 500);
  }

  const contactId = await system(async (tx) => {
    let id: string | null = null;
    if (email) {
      const [c] = await tx
        .insert(contacts)
        .values({
          workspaceId: g.ws.id,
          email,
          name: contactName,
          phone,
          tags,
          fields,
          sourceFunnelId: step.funnelId,
          sourceStepId: step.id,
          consentAt: new Date(),
          consentIp: g.ip,
        })
        .onConflictDoUpdate({
          target: [contacts.workspaceId, contacts.email],
          set: {
            name: sql`coalesce(${contacts.name}, excluded.name)`,
            phone: sql`coalesce(excluded.phone, ${contacts.phone})`,
            tags: sql`(select array(select distinct unnest(${contacts.tags} || excluded.tags)))`,
            fields: sql`coalesce(${contacts.fields}, '{}'::jsonb) || excluded.fields`,
            updatedAt: new Date(),
          },
        })
        .returning({ id: contacts.id });
      id = c!.id;
      await logActivity(tx, {
        workspaceId: g.ws.id,
        contactId: id,
        type: "form",
        body: outcome ? `${def.formName} → ${outcome.title}` : def.formName,
        data: { stepId, blockId, score },
      });
    }
    await tx.insert(formSubmissions).values({
      workspaceId: g.ws.id,
      funnelId: step.funnelId,
      stepId: step.id,
      blockId,
      formName: (def.formName || "Form").slice(0, 120),
      contactId: id,
      answers: checked.answers.map(({ key, label, type, value }) => ({ key, label, type, value })),
      score,
      outcome: outcome?.title ?? null,
    });
    return id;
  });

  if (contactId) {
    await enqueue("workflow-events", {
      workspaceId: g.ws.id,
      contactId,
      type: "form_submitted",
      data: { funnelId: step.funnelId, stepId, formName: def.formName },
    });
    await enqueue("workflow-events", {
      workspaceId: g.ws.id,
      contactId,
      type: "optin",
      data: { funnelId: step.funnelId, stepId },
      ctx: conversionContext(req),
    });
    if (tags.length)
      await enqueueMany(
        "workflow-events",
        tags.map((tag) => ({ workspaceId: g.ws.id, contactId, type: "tag_added" as const, data: { tag } })),
      );
    await track(req.headers, { workspaceId: g.ws.id, funnelId: step.funnelId, stepId: step.id, type: "optin" });
  }
  const redirect = (outcome?.redirect && safeRedirect(outcome.redirect)) || step.nextPath;
  return NextResponse.json({ ok: true, redirect, outcome: outcome?.title ?? null });
}
