import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");

export const LEGAL_BASES = [
  "consent",
  "contract",
  "legal_obligation",
  "vital_interest",
  "public_interest",
  "legitimate_interest",
] as const;

export const DSR_TYPES = [
  "access",
  "correction",
  "deletion",
  "portability",
  "anonymization",
  "opposition",
  "information",
] as const;

export const DSR_STATUSES = [
  "received",
  "identity_pending",
  "in_progress",
  "completed",
  "rejected",
  "cancelled",
] as const;

export const PRIVACY_INCIDENT_STATUSES = [
  "reported",
  "investigating",
  "contained",
  "notified",
  "closed",
] as const;

export const RETENTION_ACTIONS = ["delete", "anonymize", "archive", "review"] as const;

export const createConsentRecordSchema = z.object({
  subjectKey: z.string().trim().min(2).max(200),
  purpose: z.string().trim().min(2).max(200),
  legalBasis: z.enum(LEGAL_BASES),
  granted: z.boolean(),
  categories: z.array(z.string().trim().max(80)).max(40).default([]),
  evidenceReference: z.string().trim().max(500).optional(),
});

export const createDsrRequestSchema = z.object({
  subjectKey: z.string().trim().min(2).max(200),
  type: z.enum(DSR_TYPES),
  channel: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(4_000).optional(),
});

export const updateDsrRequestSchema = z.object({
  status: z.enum(DSR_STATUSES),
  notes: z.string().trim().max(4_000).optional(),
  completedAt: z.string().datetime({ offset: true }).optional(),
});

export const createRetentionPolicySchema = z.object({
  dataCategory: z.string().trim().min(2).max(120),
  retentionDays: z.number().int().min(1).max(36500),
  action: z.enum(RETENTION_ACTIONS),
  legalHoldExempt: z.boolean().default(false),
});

export const createPrivacyIncidentSchema = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(2).max(8_000),
  discoveredAt: z.string().datetime({ offset: true }),
  severity: z.enum(["low", "medium", "high", "critical"]),
  affectedSystems: z.array(z.string().trim().max(120)).max(40).optional(),
});

export const updatePrivacyIncidentSchema = z.object({
  status: z.enum(PRIVACY_INCIDENT_STATUSES),
  notes: z.string().trim().max(4_000).optional(),
  authorityNotifiedAt: z.string().datetime({ offset: true }).optional(),
});

export const createOperatorSchema = z.object({
  name: z.string().trim().min(2).max(200),
  role: z.enum(["controller", "processor", "subprocessor", "joint_controller"]),
  contactEmail: z.string().trim().email().max(320).optional(),
  dpaReference: z.string().trim().max(500).optional(),
});

export const privacyListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  q: z.string().trim().max(120).optional(),
  organizationId: uuid.optional(),
});
