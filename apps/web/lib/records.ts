import "server-only";

import {
  affiliates,
  and,
  asc,
  bookings,
  broadcasts,
  calendars,
  commissions,
  contactActivities,
  contacts,
  conversations,
  courseEnrollments,
  courseProducts,
  courses,
  desc,
  domains,
  emailMessages,
  emails,
  eq,
  formSubmissions,
  funnels,
  funnelSteps,
  inArray,
  isNull,
  opportunities,
  orderItems,
  orders,
  payments,
  pipelines,
  pipelineStages,
  prices,
  products,
  savedViews,
  schema,
  sql,
  stepOffers,
  subscriptions,
  workflowRuns,
  workflows,
  workspaces,
  type Tx,
} from "@zfunnel/db";
import { inWorkspace } from "./funnels";
import { buildTimeline } from "./timeline";
import type { WorkspaceContext } from "./workspaces";

const isUuid = (id: string) => /^[0-9a-f-]{36}$/i.test(id);

// ---------- Contact timeline ----------

export async function getContactTimeline(ctx: WorkspaceContext, contactId: string) {
  if (!isUuid(contactId)) return [];
  const sources = await inWorkspace(ctx, async (tx) => {
    const [os, forms, mails, books, enrolls, chats, deals, acts] = await Promise.all([
      tx.select().from(orders).where(eq(orders.contactId, contactId)).orderBy(desc(orders.createdAt)).limit(100),
      tx
        .select({
          id: formSubmissions.id,
          stepId: formSubmissions.stepId,
          blockId: formSubmissions.blockId,
          formName: formSubmissions.formName,
          createdAt: formSubmissions.createdAt,
        })
        .from(formSubmissions)
        .where(and(eq(formSubmissions.contactId, contactId), isNull(formSubmissions.deletedAt)))
        .orderBy(desc(formSubmissions.createdAt))
        .limit(100),
      tx
        .select({
          id: emailMessages.id,
          subject: emailMessages.subject,
          sentAt: emailMessages.sentAt,
          createdAt: emailMessages.createdAt,
          openedAt: emailMessages.openedAt,
          clickedAt: emailMessages.clickedAt,
          broadcastId: emailMessages.broadcastId,
          workflowId: sql<string | null>`${emailMessages.meta} ->> 'workflowId'`,
          status: emailMessages.status,
        })
        .from(emailMessages)
        .where(
          and(eq(emailMessages.contactId, contactId), sql`coalesce(${emailMessages.meta} ->> 'kind', '') <> 'login'`),
        )
        .orderBy(desc(emailMessages.createdAt))
        .limit(100),
      tx
        .select({
          id: bookings.id,
          calendarId: bookings.calendarId,
          calendarName: calendars.name,
          startAt: bookings.startAt,
          createdAt: bookings.createdAt,
          status: bookings.status,
        })
        .from(bookings)
        .innerJoin(calendars, eq(calendars.id, bookings.calendarId))
        .where(eq(bookings.contactId, contactId))
        .limit(100),
      tx
        .select({
          id: courseEnrollments.id,
          courseId: courseEnrollments.courseId,
          title: courses.title,
          createdAt: courseEnrollments.createdAt,
          revokedAt: courseEnrollments.revokedAt,
        })
        .from(courseEnrollments)
        .innerJoin(courses, eq(courses.id, courseEnrollments.courseId))
        .where(eq(courseEnrollments.contactId, contactId)),
      tx
        .select({
          id: conversations.id,
          createdAt: conversations.createdAt,
          lastMessageAt: conversations.lastMessageAt,
          status: conversations.status,
          pageUrl: conversations.pageUrl,
        })
        .from(conversations)
        .where(eq(conversations.contactId, contactId))
        .limit(50),
      tx
        .select({
          id: opportunities.id,
          title: opportunities.title,
          stage: pipelineStages.name,
          pipeline: pipelines.name,
          value: opportunities.value,
          currency: opportunities.currency,
          createdAt: opportunities.createdAt,
        })
        .from(opportunities)
        .innerJoin(pipelineStages, eq(pipelineStages.id, opportunities.stageId))
        .innerJoin(pipelines, eq(pipelines.id, opportunities.pipelineId))
        .where(eq(opportunities.contactId, contactId)),
      tx
        .select({
          id: contactActivities.id,
          type: contactActivities.type,
          body: contactActivities.body,
          actor: schema.user.name,
          createdAt: contactActivities.createdAt,
        })
        .from(contactActivities)
        .leftJoin(schema.user, eq(schema.user.id, contactActivities.actorUserId))
        .where(eq(contactActivities.contactId, contactId))
        .orderBy(desc(contactActivities.createdAt))
        .limit(200),
    ]);
    const items = os.length
      ? await tx
          .select({ orderId: orderItems.orderId, productName: orderItems.productName })
          .from(orderItems)
          .where(
            inArray(
              orderItems.orderId,
              os.map((o) => o.id),
            ),
          )
      : [];
    return {
      orders: os.map((o) => ({
        ...o,
        items: items.filter((i) => i.orderId === o.id).map((i) => i.productName),
      })),
      forms,
      emails: mails,
      bookings: books,
      courses: enrolls,
      chats,
      deals,
      activities: acts,
    };
  });
  return buildTimeline({ ws: ctx.workspace.slug, ...sources });
}

// ---------- Order detail ----------

export async function getOrderDetail(ctx: WorkspaceContext, orderId: string) {
  if (!isUuid(orderId)) return null;
  return inWorkspace(ctx, async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId));
    if (!o) return null;
    const [items, pays, subs, contact, funnel, step, affiliate] = await Promise.all([
      tx
        .select({
          item: orderItems,
          productId: prices.productId,
          productLive: sql<boolean>`${products.archivedAt} is null`,
        })
        .from(orderItems)
        .leftJoin(prices, eq(prices.id, orderItems.priceId))
        .leftJoin(products, eq(products.id, prices.productId))
        .where(eq(orderItems.orderId, o.id))
        .orderBy(asc(orderItems.createdAt)),
      tx.select().from(payments).where(eq(payments.orderId, o.id)).orderBy(asc(payments.createdAt)),
      tx.select().from(subscriptions).where(eq(subscriptions.orderId, o.id)),
      o.contactId
        ? tx
            .select({ id: contacts.id, email: contacts.email, name: contacts.name, deletedAt: contacts.deletedAt })
            .from(contacts)
            .where(eq(contacts.id, o.contactId))
        : Promise.resolve([]),
      o.funnelId
        ? tx
            .select({ id: funnels.id, name: funnels.name, archivedAt: funnels.archivedAt })
            .from(funnels)
            .where(eq(funnels.id, o.funnelId))
        : Promise.resolve([]),
      o.stepId
        ? tx
            .select({ id: funnelSteps.id, name: funnelSteps.name, deletedAt: funnelSteps.deletedAt })
            .from(funnelSteps)
            .where(eq(funnelSteps.id, o.stepId))
        : Promise.resolve([]),
      o.affiliateId
        ? tx
            .select({
              id: affiliates.id,
              code: affiliates.code,
              email: contacts.email,
              name: contacts.name,
              commission: commissions.amount,
              commissionStatus: commissions.status,
            })
            .from(affiliates)
            .innerJoin(contacts, eq(contacts.id, affiliates.contactId))
            .leftJoin(commissions, and(eq(commissions.affiliateId, affiliates.id), eq(commissions.orderId, o.id)))
            .where(eq(affiliates.id, o.affiliateId))
        : Promise.resolve([]),
    ]);
    const c = contact[0];
    const f = funnel[0];
    const s = step[0];
    return {
      order: o,
      items,
      payments: pays,
      subscriptions: subs,
      contact: c ? { ...c, live: !c.deletedAt } : null,
      funnel: f ? { ...f, live: !f.archivedAt } : null,
      step: s ? { ...s, live: !s.deletedAt && !f?.archivedAt } : null,
      affiliate: affiliate[0] ?? null,
    };
  });
}

// ---------- Product detail ----------

export async function getProductDetail(ctx: WorkspaceContext, productId: string) {
  if (!isUuid(productId)) return null;
  return inWorkspace(ctx, async (tx) => {
    const [p] = await tx
      .select()
      .from(products)
      .where(and(eq(products.id, productId), isNull(products.archivedAt)));
    if (!p) return null;
    const priceRows = await tx.select().from(prices).where(eq(prices.productId, p.id)).orderBy(asc(prices.createdAt));
    const priceIds = priceRows.map((r) => r.id);
    const [soldIn, grants, revenue, recent] = await Promise.all([
      priceIds.length
        ? tx
            .select({
              offerId: stepOffers.id,
              role: stepOffers.role,
              stepId: funnelSteps.id,
              stepName: funnelSteps.name,
              funnelId: funnels.id,
              funnelName: funnels.name,
            })
            .from(stepOffers)
            .innerJoin(funnelSteps, and(eq(funnelSteps.id, stepOffers.stepId), isNull(funnelSteps.deletedAt)))
            .innerJoin(funnels, and(eq(funnels.id, funnelSteps.funnelId), isNull(funnels.archivedAt)))
            .where(inArray(stepOffers.priceId, priceIds))
            .orderBy(asc(funnels.name), asc(funnelSteps.position))
        : Promise.resolve([]),
      tx
        .select({ id: courses.id, title: courses.title, status: courses.status })
        .from(courseProducts)
        .innerJoin(courses, eq(courses.id, courseProducts.courseId))
        .where(eq(courseProducts.productId, p.id)),
      priceIds.length
        ? tx
            .select({
              funnelId: orders.funnelId,
              funnelName: funnels.name,
              currency: orders.currency,
              revenue: sql<number>`coalesce(sum(${orderItems.amount}), 0)::int`,
              sales: sql<number>`count(*)::int`,
            })
            .from(orderItems)
            .innerJoin(orders, eq(orders.id, orderItems.orderId))
            .leftJoin(funnels, eq(funnels.id, orders.funnelId))
            .where(and(inArray(orderItems.priceId, priceIds), eq(orderItems.status, "paid")))
            .groupBy(orders.funnelId, funnels.name, orders.currency)
            .orderBy(sql`4 desc`)
        : Promise.resolve([]),
      priceIds.length
        ? tx
            .select({
              id: orders.id,
              number: orders.number,
              status: orders.status,
              test: orders.test,
              createdAt: orders.createdAt,
              amount: orderItems.amount,
              currency: orders.currency,
              email: contacts.email,
            })
            .from(orderItems)
            .innerJoin(orders, eq(orders.id, orderItems.orderId))
            .leftJoin(contacts, eq(contacts.id, orders.contactId))
            .where(inArray(orderItems.priceId, priceIds))
            .orderBy(desc(orders.createdAt))
            .limit(10)
        : Promise.resolve([]),
    ]);
    return { product: p, prices: priceRows, soldIn, grants, revenue, recent };
  });
}

// ---------- Funnel links ----------

/** Products sold, forms collected and automations triggered by a funnel. */
export async function getFunnelLinks(ctx: WorkspaceContext, funnelId: string) {
  if (!isUuid(funnelId)) return null;
  return inWorkspace(ctx, async (tx) => {
    const [sold, forms, autos] = await Promise.all([
      tx
        .selectDistinct({ id: products.id, name: products.name, role: stepOffers.role, stepId: funnelSteps.id })
        .from(stepOffers)
        .innerJoin(funnelSteps, and(eq(funnelSteps.id, stepOffers.stepId), isNull(funnelSteps.deletedAt)))
        .innerJoin(prices, eq(prices.id, stepOffers.priceId))
        .innerJoin(products, and(eq(products.id, prices.productId), isNull(products.archivedAt)))
        .where(eq(funnelSteps.funnelId, funnelId)),
      tx
        .select({
          stepId: formSubmissions.stepId,
          blockId: formSubmissions.blockId,
          formName: sql<string>`(array_agg(${formSubmissions.formName} order by ${formSubmissions.createdAt} desc))[1]`,
          responses: sql<number>`count(*)::int`,
        })
        .from(formSubmissions)
        .where(and(eq(formSubmissions.funnelId, funnelId), isNull(formSubmissions.deletedAt)))
        .groupBy(formSubmissions.stepId, formSubmissions.blockId),
      tx
        .select({ id: workflows.id, name: workflows.name, status: workflows.status, trigger: workflows.trigger })
        .from(workflows)
        .where(and(isNull(workflows.deletedAt), sql`${workflows.trigger} ->> 'funnelId' = ${funnelId}`)),
    ]);
    const products_ = [...new Map(sold.map((s) => [s.id, s])).values()];
    return { products: products_, offers: sold, forms, automations: autos };
  });
}

// ---------- "Used in" ----------

export type UsedInKind = "product" | "form" | "funnel" | "email" | "automation" | "contact" | "step";

/**
 * One dependent of a record about to be deleted. `type` picks the label; `name` and `count`
 * are data. The dialog warns about these but still allows the delete.
 */
export type UsedInItem = {
  type:
    | "offer"
    | "course"
    | "automationTrigger"
    | "automationStep"
    | "orders"
    | "broadcast"
    | "domain"
    | "home"
    | "contacts"
    | "responses"
    | "runs"
    | "steps"
    | "linkedFrom"
    | "page"
    | "deals"
    | "affiliate";
  name?: string;
  /** Offer role on a step (main/bump/upsell/downsell). */
  role?: "main" | "bump" | "upsell" | "downsell";
  count?: number;
  href?: string;
};

export async function usedIn(ctx: WorkspaceContext, kind: UsedInKind, id: string): Promise<UsedInItem[]> {
  const ws = ctx.workspace.slug;
  return inWorkspace(ctx, async (tx) => {
    switch (kind) {
      case "product":
        return productUsedIn(tx, ws, id);
      case "form":
        return formUsedIn(tx, ws, id);
      case "funnel":
        return funnelUsedIn(tx, ctx, id);
      case "email":
        return emailUsedIn(tx, ws, id);
      case "automation":
        return automationUsedIn(tx, ws, id);
      case "contact":
        return contactUsedIn(tx, ws, id);
      case "step":
        return stepUsedIn(tx, ws, id);
    }
  });
}

async function productUsedIn(tx: Tx, ws: string, id: string): Promise<UsedInItem[]> {
  if (!isUuid(id)) return [];
  const priceIds = (await tx.select({ id: prices.id }).from(prices).where(eq(prices.productId, id))).map((p) => p.id);
  const [offers, grants, autos, [sold]] = await Promise.all([
    priceIds.length
      ? tx
          .select({
            role: stepOffers.role,
            step: funnelSteps.name,
            funnel: funnels.name,
            funnelId: funnels.id,
            stepId: funnelSteps.id,
          })
          .from(stepOffers)
          .innerJoin(funnelSteps, and(eq(funnelSteps.id, stepOffers.stepId), isNull(funnelSteps.deletedAt)))
          .innerJoin(funnels, and(eq(funnels.id, funnelSteps.funnelId), isNull(funnels.archivedAt)))
          .where(inArray(stepOffers.priceId, priceIds))
      : Promise.resolve([]),
    tx
      .select({ id: courses.id, title: courses.title })
      .from(courseProducts)
      .innerJoin(courses, eq(courses.id, courseProducts.courseId))
      .where(eq(courseProducts.productId, id)),
    tx
      .select({ id: workflows.id, name: workflows.name })
      .from(workflows)
      .where(and(isNull(workflows.deletedAt), sql`${workflows.trigger} ->> 'productId' = ${id}`)),
    priceIds.length
      ? tx
          .select({ n: sql<number>`count(distinct ${orderItems.orderId})::int` })
          .from(orderItems)
          .where(inArray(orderItems.priceId, priceIds))
      : Promise.resolve([{ n: 0 }]),
  ]);
  return [
    ...offers.map((o) => ({
      type: "offer" as const,
      name: `${o.funnel} › ${o.step}`,
      role: o.role,
      href: `/${ws}/funnels/${o.funnelId}?step=${o.stepId}`,
    })),
    ...grants.map((c) => ({ type: "course" as const, name: c.title, href: `/${ws}/courses/${c.id}` })),
    ...autos.map((a) => ({ type: "automationTrigger" as const, name: a.name, href: `/automation/${ws}/${a.id}` })),
    ...(sold?.n ? [{ type: "orders" as const, count: sold.n }] : []),
  ];
}

/** Forms are identified by "stepId:blockId". */
export function parseFormKey(key: string) {
  const i = key.indexOf(":");
  const stepId = key.slice(0, i);
  const blockId = key.slice(i + 1);
  return i > 0 && isUuid(stepId) && blockId.length > 0 && blockId.length <= 200 ? { stepId, blockId } : null;
}

async function formUsedIn(tx: Tx, ws: string, key: string): Promise<UsedInItem[]> {
  const f = parseFormKey(key);
  if (!f) return [];
  const [[step], [count]] = await Promise.all([
    tx
      .select({ name: funnelSteps.name, funnel: funnels.name, funnelId: funnels.id })
      .from(funnelSteps)
      .innerJoin(funnels, eq(funnels.id, funnelSteps.funnelId))
      .where(and(eq(funnelSteps.id, f.stepId), isNull(funnelSteps.deletedAt), isNull(funnels.archivedAt))),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(formSubmissions)
      .where(
        and(
          eq(formSubmissions.stepId, f.stepId),
          eq(formSubmissions.blockId, f.blockId),
          isNull(formSubmissions.deletedAt),
        ),
      ),
  ]);
  const autos = step
    ? await tx
        .select({ id: workflows.id, name: workflows.name })
        .from(workflows)
        .where(
          and(
            isNull(workflows.deletedAt),
            sql`${workflows.trigger} ->> 'type' = 'form_submitted'`,
            sql`coalesce(${workflows.trigger} ->> 'funnelId', ${step.funnelId}) = ${step.funnelId}`,
          ),
        )
    : [];
  return [
    ...(step
      ? [
          {
            type: "page" as const,
            name: `${step.funnel} › ${step.name}`,
            href: `/${ws}/funnels/${step.funnelId}?step=${f.stepId}`,
          },
        ]
      : []),
    ...(count?.n ? [{ type: "responses" as const, count: count.n }] : []),
    ...autos.map((a) => ({ type: "automationTrigger" as const, name: a.name, href: `/automation/${ws}/${a.id}` })),
  ];
}

async function funnelUsedIn(tx: Tx, ctx: WorkspaceContext, id: string): Promise<UsedInItem[]> {
  if (!isUuid(id)) return [];
  const ws = ctx.workspace.slug;
  const [[steps], doms, autos, [leads], [sold], [home]] = await Promise.all([
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(funnelSteps)
      .where(and(eq(funnelSteps.funnelId, id), isNull(funnelSteps.deletedAt))),
    tx.select({ hostname: domains.hostname }).from(domains).where(eq(domains.funnelId, id)),
    tx
      .select({ id: workflows.id, name: workflows.name })
      .from(workflows)
      .where(and(isNull(workflows.deletedAt), sql`${workflows.trigger} ->> 'funnelId' = ${id}`)),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(contacts)
      .where(and(eq(contacts.sourceFunnelId, id), isNull(contacts.deletedAt))),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.funnelId, id)),
    tx.select({ homeFunnelId: workspaces.homeFunnelId }).from(workspaces).where(eq(workspaces.id, ctx.workspace.id)),
  ]);
  return [
    ...(steps?.n ? [{ type: "steps" as const, count: steps.n }] : []),
    ...(home?.homeFunnelId === id ? [{ type: "home" as const }] : []),
    ...doms.map((d) => ({ type: "domain" as const, name: d.hostname, href: `/${ws}/settings/domains` })),
    ...autos.map((a) => ({ type: "automationTrigger" as const, name: a.name, href: `/automation/${ws}/${a.id}` })),
    ...(leads?.n ? [{ type: "contacts" as const, count: leads.n }] : []),
    ...(sold?.n ? [{ type: "orders" as const, count: sold.n }] : []),
  ];
}

async function stepUsedIn(tx: Tx, ws: string, id: string): Promise<UsedInItem[]> {
  if (!isUuid(id)) return [];
  const [offers, [resp], [sold], refs] = await Promise.all([
    tx
      .select({ name: products.name, role: stepOffers.role, productId: products.id })
      .from(stepOffers)
      .innerJoin(prices, eq(prices.id, stepOffers.priceId))
      .innerJoin(products, and(eq(products.id, prices.productId), isNull(products.archivedAt)))
      .where(eq(stepOffers.stepId, id)),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(formSubmissions)
      .where(and(eq(formSubmissions.stepId, id), isNull(formSubmissions.deletedAt))),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.stepId, id)),
    tx
      .select({ name: funnelSteps.name })
      .from(funnelSteps)
      .where(
        and(
          isNull(funnelSteps.deletedAt),
          sql`(${funnelSteps.nextStepId} = ${id} or ${funnelSteps.declineStepId} = ${id})`,
        ),
      ),
  ]);
  return [
    ...offers.map((o) => ({
      type: "offer" as const,
      name: o.name,
      role: o.role,
      href: `/${ws}/products/${o.productId}`,
    })),
    ...refs.map((r) => ({ type: "linkedFrom" as const, name: r.name })),
    ...(resp?.n ? [{ type: "responses" as const, count: resp.n }] : []),
    ...(sold?.n ? [{ type: "orders" as const, count: sold.n }] : []),
  ];
}

async function emailUsedIn(tx: Tx, ws: string, id: string): Promise<UsedInItem[]> {
  if (!isUuid(id)) return [];
  const [autos, casts] = await Promise.all([
    tx
      .select({ id: workflows.id, name: workflows.name })
      .from(workflows)
      .where(
        and(
          isNull(workflows.deletedAt),
          sql`exists (select 1 from jsonb_each(${workflows.graph} -> 'nodes') n where n.value ->> 'type' = 'send_email' and n.value ->> 'emailId' = ${id})`,
        ),
      ),
    tx
      .select({ id: broadcasts.id, name: emails.name })
      .from(broadcasts)
      .innerJoin(emails, eq(emails.id, broadcasts.emailId))
      .where(eq(broadcasts.emailId, id)),
  ]);
  return [
    ...autos.map((a) => ({ type: "automationStep" as const, name: a.name, href: `/automation/${ws}/${a.id}` })),
    ...casts.map((b) => ({ type: "broadcast" as const, name: b.name, href: `/${ws}/email/${b.id}` })),
  ];
}

async function automationUsedIn(tx: Tx, ws: string, id: string): Promise<UsedInItem[]> {
  if (!isUuid(id)) return [];
  const [[runs], [wf]] = await Promise.all([
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(workflowRuns)
      .where(and(eq(workflowRuns.workflowId, id), inArray(workflowRuns.status, ["active", "waiting"]))),
    tx.select({ graph: workflows.graph }).from(workflows).where(eq(workflows.id, id)),
  ]);
  const emailIds = Object.values(wf?.graph.nodes ?? {}).flatMap((n) =>
    n.type === "send_email" && n.emailId ? [n.emailId] : [],
  );
  const mails = emailIds.length
    ? await tx.select({ id: emails.id, name: emails.name }).from(emails).where(inArray(emails.id, emailIds))
    : [];
  return [
    ...(runs?.n ? [{ type: "runs" as const, count: runs.n }] : []),
    ...mails.map((m) => ({ type: "automationStep" as const, name: m.name, href: `/email-editor/${ws}/${m.id}` })),
  ];
}

async function contactUsedIn(tx: Tx, ws: string, id: string): Promise<UsedInItem[]> {
  if (!isUuid(id)) return [];
  const [[o], [d], [r], [a]] = await Promise.all([
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(eq(orders.contactId, id)),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(opportunities)
      .where(eq(opportunities.contactId, id)),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(workflowRuns)
      .where(and(eq(workflowRuns.contactId, id), inArray(workflowRuns.status, ["active", "waiting"]))),
    tx
      .select({ n: sql<number>`count(*)::int` })
      .from(affiliates)
      .where(eq(affiliates.contactId, id)),
  ]);
  return [
    ...(o?.n ? [{ type: "orders" as const, count: o.n }] : []),
    ...(d?.n ? [{ type: "deals" as const, count: d.n, href: `/${ws}/pipelines` }] : []),
    ...(r?.n ? [{ type: "runs" as const, count: r.n }] : []),
    ...(a?.n ? [{ type: "affiliate" as const, href: `/${ws}/affiliates` }] : []),
  ];
}

// ---------- Saved views ----------

export async function listViews(ctx: WorkspaceContext, resource: "contacts" | "orders") {
  return inWorkspace(ctx, (tx) =>
    tx
      .select({ id: savedViews.id, name: savedViews.name, filters: savedViews.filters })
      .from(savedViews)
      .where(eq(savedViews.resource, resource))
      .orderBy(asc(savedViews.name)),
  );
}
