import type { SegmentRule } from "@zfunnel/db";
import { z } from "zod";

export const ruleSchema: z.ZodType<SegmentRule> = z.union([
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
