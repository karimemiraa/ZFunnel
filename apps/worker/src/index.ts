import { Worker, type Processor } from "bullmq";
import { QUEUES, redis, type SystemJob } from "@zfunnel/queue";
import { processBroadcast, processEmail } from "./jobs/email";

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
];

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, draining…`);
  await Promise.all(workers.map((w) => w.close()));
  connection.disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
