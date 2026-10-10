/**
 * Queue names shared by producers (apps/web, apps/sites) and this worker.
 * Phase 1+ adds: email-send, workflow-step, webhook-out, analytics-rollup, domain-verify.
 */
export const QUEUES = {
  system: "system",
} as const;

export type SystemJob = { type: "ping"; sentAt: string };
