import { z } from "zod";
import { RESERVED_SLUGS } from "./slug";

// Messages are i18n keys (workspace.validation.*); the app translates them with localizeMessage().

export const slugSchema = z
  .string()
  .min(3, "workspace.validation.minThree")
  .max(48, "workspace.validation.maxLength")
  .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, "workspace.validation.slugChars")
  .refine((s) => !RESERVED_SLUGS.has(s), "workspace.validation.reserved");

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(2, "workspace.validation.minTwo").max(80),
  slug: slugSchema,
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "workspace.validation.minTwo").max(80),
  slug: slugSchema,
});

/** Organization roles, highest first. Mirrors Better Auth's organization plugin roles. */
export const ROLES = ["owner", "admin", "member"] as const;
export type Role = (typeof ROLES)[number];
