import { z } from "zod";
import { RESERVED_SLUGS } from "./slug";

export const slugSchema = z
  .string()
  .min(3, "At least 3 characters")
  .max(48, "At most 48 characters")
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "Lowercase letters, numbers and dashes only")
  .refine((s) => !RESERVED_SLUGS.has(s), "This name is reserved");

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(80),
  slug: slugSchema,
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(80),
  slug: slugSchema,
});

/** Organization roles, highest first. Mirrors Better Auth's organization plugin roles. */
export const ROLES = ["owner", "admin", "member"] as const;
export type Role = (typeof ROLES)[number];
