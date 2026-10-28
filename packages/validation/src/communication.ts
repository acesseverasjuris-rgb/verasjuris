import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const nullableUuid = uuid.nullable().optional();
const datetime = z.string().datetime({ offset: true });
const optionalDatetime = datetime.optional();

export const COMMUNICATION_CHANNELS = ["in_app", "email", "sms", "whatsapp", "push"] as const;

export const COMMUNICATION_CATEGORIES = [
  "transactional",
  "case_update",
  "appointment",
  "document",
  "payment",
  "contract",
  "marketing",
  "security",
  "system",
] as const;

export const COMMUNICATION_CONSENT_STATUSES = [
  "unknown",
  "opted_in",
  "opted_out",
  "required",
  "not_applicable",
] as const;

export const COMMUNICATION_MESSAGE_STATUSES = [
  "draft",
  "queued",
  "sending",
  "sent",
  "delivered",
  "failed",
  "cancelled",
  "not_configured",
] as const;

export const COMMUNICATION_OUTBOX_STATUSES = [
  "pending",
  "processing",
  "completed",
  "failed",
  "cancelled",
  "not_configured",
] as const;

export const createCommunicationTemplateSchema = z.object({
  scope: z.string().trim().min(1).max(40).default("organization"),
  channel: z.enum(COMMUNICATION_CHANNELS),
  key: z.string().trim().min(1).max(80),
  name: z.string().trim().min(2).max(200),
  subjectTemplate: z.string().trim().max(500).optional(),
  bodyTemplate: z.string().trim().min(1).max(100_000),
  variableSchema: z.record(z.string(), z.unknown()).optional(),
  category: z.enum(COMMUNICATION_CATEGORIES).default("system"),
  active: z.boolean().default(true),
});

export const updateCommunicationTemplateSchema = createCommunicationTemplateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createCommunicationTemplateVersionSchema = z.object({
  templateId: uuid,
  version: z.number().int().min(1).max(10_000),
  subjectTemplate: z.string().trim().max(500).optional(),
  bodyTemplate: z.string().trim().min(1).max(100_000),
  variableSchema: z.record(z.string(), z.unknown()).optional(),
  locked: z.boolean().default(false),
});

export const createCommunicationPreferenceSchema = z.object({
  userId: uuid,
  channel: z.enum(COMMUNICATION_CHANNELS),
  category: z.enum(COMMUNICATION_CATEGORIES),
  enabled: z.boolean().default(true),
  quietHoursStart: z.string().trim().max(8).optional(),
  quietHoursEnd: z.string().trim().max(8).optional(),
  language: z.string().trim().min(2).max(16).default("pt-BR"),
});

export const updateCommunicationPreferenceSchema = createCommunicationPreferenceSchema
  .omit({ userId: true, channel: true, category: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const upsertCommunicationConsentSchema = z.object({
  subjectType: z.string().trim().min(1).max(40),
  subjectId: uuid,
  channel: z.enum(COMMUNICATION_CHANNELS),
  category: z.enum(COMMUNICATION_CATEGORIES),
  status: z.enum(COMMUNICATION_CONSENT_STATUSES).default("unknown"),
  source: z.string().trim().min(1).max(40).default("manual"),
  grantedAt: optionalDatetime,
  revokedAt: optionalDatetime,
  evidence: z.string().trim().max(2000).optional(),
});

export const sendCommunicationMessageSchema = z
  .object({
    recipientType: z.string().trim().min(1).max(40),
    recipientId: uuid,
    channel: z.enum(COMMUNICATION_CHANNELS),
    category: z.enum(COMMUNICATION_CATEGORIES).default("system"),
    templateVersionId: optionalUuid,
    subject: z.string().trim().max(500).optional(),
    bodySnapshot: z.string().trim().min(1).max(100_000).optional(),
    variables: z.record(z.string(), z.string()).optional(),
    idempotencyKey: z.string().trim().min(8).max(120).optional(),
    scheduledAt: optionalDatetime,
  })
  .refine((value) => Boolean(value.bodySnapshot?.trim()) || Boolean(value.templateVersionId), {
    message: "Informe bodySnapshot ou templateVersionId.",
  });

export const communicationListQuerySchema = z.object({
  channel: z.enum(COMMUNICATION_CHANNELS).optional(),
  category: z.enum(COMMUNICATION_CATEGORIES).optional(),
  status: z.enum(COMMUNICATION_MESSAGE_STATUSES).optional(),
  recipientType: z.string().trim().max(40).optional(),
  recipientId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const communicationOutboxListQuerySchema = z.object({
  status: z.enum(COMMUNICATION_OUTBOX_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
