import "server-only";

import { and, contacts, desc, eq, formSubmissions, funnels, funnelSteps, sql } from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import type { WorkspaceContext } from "./workspaces";

export async function listForms(ctx: WorkspaceContext) {
  return inWorkspace(ctx, (tx) =>
    tx
      .select({
        stepId: formSubmissions.stepId,
        blockId: formSubmissions.blockId,
        formName: sql<string>`(array_agg(${formSubmissions.formName} order by ${formSubmissions.createdAt} desc))[1]`,
        responses: sql<number>`count(*)::int`,
        contacts: sql<number>`count(distinct ${formSubmissions.contactId})::int`,
        last: sql<Date>`max(${formSubmissions.createdAt})`,
        funnelName: sql<string | null>`max(${funnels.name})`,
        stepName: sql<string | null>`max(${funnelSteps.name})`,
      })
      .from(formSubmissions)
      .leftJoin(funnels, eq(funnels.id, formSubmissions.funnelId))
      .leftJoin(funnelSteps, eq(funnelSteps.id, formSubmissions.stepId))
      .groupBy(formSubmissions.stepId, formSubmissions.blockId)
      .orderBy(sql`max(${formSubmissions.createdAt}) desc`),
  );
}

export async function getFormResponses(ctx: WorkspaceContext, stepId: string, blockId: string, limit = 5000) {
  if (!/^[0-9a-f-]{36}$/i.test(stepId)) return [];
  return inWorkspace(ctx, (tx) =>
    tx
      .select({ s: formSubmissions, email: contacts.email, name: contacts.name })
      .from(formSubmissions)
      .leftJoin(contacts, eq(contacts.id, formSubmissions.contactId))
      .where(and(eq(formSubmissions.stepId, stepId), eq(formSubmissions.blockId, blockId)))
      .orderBy(desc(formSubmissions.createdAt))
      .limit(limit),
  );
}

export type QuestionSummary = {
  key: string;
  label: string;
  answered: number;
  choices: { value: string; n: number }[] | null;
  samples: string[];
};

/** Per-question summary: counts per option for choice questions, latest answers for text. */
export function summarize(rows: Awaited<ReturnType<typeof getFormResponses>>): QuestionSummary[] {
  const byKey = new Map<
    string,
    { label: string; answered: number; counts: Map<string, number>; multi: boolean; choice: boolean; texts: string[] }
  >();
  for (const { s } of rows) {
    for (const a of s.answers) {
      const q = byKey.get(a.key) ?? {
        label: a.label,
        answered: 0,
        counts: new Map<string, number>(),
        multi: false,
        choice: false,
        texts: [] as string[],
      };
      q.answered++;
      for (const v of Array.isArray(a.value) ? a.value : [a.value]) q.counts.set(v, (q.counts.get(v) ?? 0) + 1);
      if (Array.isArray(a.value)) q.multi = true;
      if (a.type && ["single_choice", "multiple_choice", "dropdown"].includes(a.type)) q.choice = true;
      if (!Array.isArray(a.value) && q.texts.length < 5) q.texts.push(a.value);
      byKey.set(a.key, q);
    }
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)))
    .map(([key, q]) => {
      // Treat as a choice question when answers repeat (few distinct values) or it's multi-select.
      const distinct = q.counts.size;
      const isChoice = q.choice || q.multi || (distinct <= 12 && distinct < q.answered);
      return {
        key,
        label: q.label,
        answered: q.answered,
        choices: isChoice
          ? [...q.counts.entries()].map(([value, n]) => ({ value, n })).sort((a, b) => b.n - a.n)
          : null,
        samples: isChoice ? [] : q.texts,
      };
    });
}
