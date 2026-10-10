import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { QUEUES, type SystemJob } from "./queues";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", { maxRetriesPerRequest: null });

const system = new Worker<SystemJob>(
  QUEUES.system,
  async (job) => {
    switch (job.data.type) {
      case "ping":
        return { pong: new Date().toISOString(), latencyMs: Date.now() - Date.parse(job.data.sentAt) };
    }
  },
  { connection, concurrency: 5 },
);

system.on("failed", (job, err) => console.error(`[${QUEUES.system}] job ${job?.id} failed:`, err.message));
system.on("ready", () => console.log(`[worker] listening on queue "${QUEUES.system}"`));

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, draining…`);
  await system.close();
  connection.disconnect();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
