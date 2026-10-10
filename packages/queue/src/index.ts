import { Queue, type JobsOptions } from "bullmq";
import { Redis } from "ioredis";

/**
 * Queue names and job payloads shared by producers (web, sites) and the worker.
 * Payloads carry ids only; the worker reloads everything from the database.
 */
export const QUEUES = {
  system: "system",
  email: "email",
  broadcast: "broadcast",
  workflowEvents: "workflow-events",
  workflowRuns: "workflow-runs",
  webhooks: "webhooks",
  conversions: "conversions",
} as const;

export type SystemJob = { type: "ping"; sentAt: string };
export type EmailJob = { messageId: string };
export type BroadcastJob = { broadcastId: string };
export type WorkflowEvent = {
  workspaceId: string;
  contactId: string;
  type:
    | "optin"
    | "purchase"
    | "tag_added"
    | "form_submitted"
    | "booked"
    | "webinar_registered"
    | "webinar_attended"
    | "manual";
  /** Matching hints: funnel/step ids, tag name, product/price ids… */
  data?: Record<string, string | undefined>;
  /**
   * Visitor context for server-side ad conversions (IP, user agent, click ids). Kept apart from
   * `data` so it never reaches customer webhooks.
   */
  ctx?: ConversionContext;
};
export type ConversionContext = {
  ip?: string;
  ua?: string;
  url?: string;
  /** Meta _fbp / _fbc cookies. */
  fbp?: string;
  fbc?: string;
  /** TikTok _ttp cookie and ttclid. */
  ttp?: string;
  ttclid?: string;
  /** GA4 client id from the _ga cookie. */
  gaClientId?: string;
};
export type ConversionJob = { deliveryId: string };
export type WorkflowRunJob = { runId: string };
export type WebhookJob = { deliveryId: string };

type Payloads = {
  system: SystemJob;
  email: EmailJob;
  broadcast: BroadcastJob;
  "workflow-events": WorkflowEvent;
  "workflow-runs": WorkflowRunJob;
  webhooks: WebhookJob;
  conversions: ConversionJob;
};
export type QueueName = keyof Payloads;

let connection: Redis | null = null;
export function redis() {
  if (!connection)
    connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  return connection;
}

const queues = new Map<string, Queue>();
export function queue<N extends QueueName>(name: N): Queue<Payloads[N]> {
  if (!queues.has(name))
    queues.set(
      name,
      new Queue(name, {
        connection: redis(),
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      }),
    );
  return queues.get(name) as Queue<Payloads[N]>;
}

/** Fire-and-forget bulk enqueue (same contract as enqueue). */
export async function enqueueMany<N extends QueueName>(name: N, items: Payloads[N][]) {
  try {
    for (let i = 0; i < items.length; i += 500)
      await (queue(name) as unknown as Queue).addBulk(items.slice(i, i + 500).map((data) => ({ name, data })));
    return true;
  } catch (err) {
    console.error(`[queue] could not enqueue ${name}:`, (err as Error).message);
    return false;
  }
}

/**
 * Fire-and-forget enqueue for request handlers: a Redis outage must never break a
 * checkout or an opt-in, so failures are logged, not thrown.
 */
export async function enqueue<N extends QueueName>(name: N, data: Payloads[N], opts?: JobsOptions) {
  try {
    await (queue(name) as unknown as Queue).add(name, data, opts);
    return true;
  } catch (err) {
    console.error(`[queue] could not enqueue ${name}:`, (err as Error).message);
    return false;
  }
}
