import { Worker, type Processor } from "bullmq";
import { QUEUES, redis, type SystemJob } from "@zfunnel/queue";
import { fanOutConversions, processConversion } from "./jobs/conversions";
import { processBroadcast, processEmail } from "./jobs/email";
import { fanOutWebhooks, processWebhook } from "./jobs/webhooks";
import { processWorkflowEvent, processWorkflowRun } from "./jobs/workflows";

const connection = redis();

function start<T>(
  name: string,
  processor: Processor<T>,
  opts: { concurrency?: number; limiter?: { max: number; duration: number } } = {},
) {
  const w = new Worker<T>(name, processor, { connection, concurrency: opts.concurrency ?? 5, limiter: opts.limiter });
  w.on("failed", (job, err) =>
    console.error(`[${name}] job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message),
  );
  w.on("ready", () => console.log(`[worker] listening on queue "${name}"`));
  return w;
}

const workers = [
  start<SystemJob>(QUEUES.system, async (job) => ({
    pong: new Date().toISOString(),
    latencyMs: Date.now() - Date.parse(job.data.sentAt),
  })),
  start(QUEUES.broadcast, (job) => processBroadcast(job.data as never), { concurrency: 2 }),
  // Global send rate: 10 emails/second (adjust to your SMTP provider's limit).
  start(QUEUES.email, (job) => processEmail(job.data as never), {
    concurrency: 10,
    limiter: { max: 10, duration: 1000 },
  }),
  start(QUEUES.workflowEvents, async (job) => {
    const id = job.id ?? `${Date.now()}`;
    // Outgoing webhooks are a side channel: failing to queue them must not block automations.
    const hooks = await fanOutWebhooks(job.data as never, id).catch(
      (err) => (console.error("[webhooks] fan-out", err), 0),
    );
    // Ad-platform conversions are a side channel too.
    const conversions = await fanOutConversions(job.data as never, id).catch(
      (err) => (console.error("[conversions] fan-out", err), 0),
    );
    return { ...(await processWorkflowEvent(job.data as never, id)), webhooks: hooks, conversions };
  }),
  start(QUEUES.webhooks, (job) => processWebhook(job.data as never, job.attemptsMade, job.opts.attempts ?? 1), {
    concurrency: 10,
  }),
  start(QUEUES.conversions, (job) => processConversion(job.data as never, job.attemptsMade, job.opts.attempts ?? 1), {
    concurrency: 10,
  }),
  start(QUEUES.workflowRuns, (job) => processWorkflowRun(job.data as never), { concurrency: 10 }),
];

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, draining…`);
  await Promise.all(workers.map((w) => w.close()));
  connection.disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
