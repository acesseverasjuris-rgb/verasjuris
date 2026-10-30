import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");

export const ASSISTANT_MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export const ASSISTANT_SESSION_STATUSES = [
  "active",
  "archived",
  "blocked",
  "not_configured",
] as const;

export const createAssistantSessionSchema = z.object({
  title: z.string().trim().max(200).optional(),
  locale: z.string().trim().min(2).max(16).optional(),
  contextType: z.string().trim().max(80).optional(),
  contextId: uuid.optional(),
});

export const sendAssistantMessageSchema = z.object({
  sessionId: uuid,
  content: z.string().trim().min(1).max(16_000),
  /** Ações críticas exigem confirmação humana explícita — nunca automáticas. */
  requestCriticalAction: z.boolean().default(false),
  criticalActionKey: z.string().trim().max(120).optional(),
});

export const assistantSessionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  status: z.enum(ASSISTANT_SESSION_STATUSES).optional(),
});

export const updateAssistantSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  defaultLocale: z.string().trim().min(2).max(16).optional(),
  allowCriticalActions: z.literal(false).default(false),
  systemPromptOverride: z.string().trim().max(8_000).optional(),
});
