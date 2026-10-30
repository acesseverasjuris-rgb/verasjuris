import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");

export const MFA_STATUSES = ["disabled", "enabled", "required", "locked"] as const;
export const MFA_ORG_POLICIES = [
  "optional",
  "required_admin",
  "required_sensitive",
  "required_all",
] as const;
export const MFA_METHOD_KINDS = ["totp", "recovery", "passkey"] as const;

export const SECURITY_EVENT_TYPES = [
  "login_failure",
  "mfa_failure",
  "session_anomaly",
  "privilege_escalation_attempt",
  "api_abuse",
  "webhook_signature_failure",
  "other",
] as const;

export const SECURITY_ALERT_STATUSES = ["open", "acknowledged", "resolved", "dismissed"] as const;

export const SECURITY_VULNERABILITY_STATUSES = [
  "open",
  "triaged",
  "mitigated",
  "fixed",
  "accepted_risk",
  "false_positive",
] as const;

export const SECURITY_PENTEST_STATUSES = [
  "planned",
  "in_progress",
  "report_received",
  "remediating",
  "closed",
] as const;

export const enableTotpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Informe o código TOTP de 6 dígitos."),
});

export const verifyTotpSchema = enableTotpSchema;

export const verifyMfaRecoveryCodeSchema = z.object({
  code: z.string().trim().min(8).max(64),
});

export const updateOrgMfaPolicySchema = z.object({
  policy: z.enum(MFA_ORG_POLICIES),
});

export const registerPasskeySchema = z.object({
  credentialId: z.string().trim().min(16).max(512),
  publicKey: z.string().trim().min(16).max(8_192),
  counter: z.number().int().min(0).default(0),
  transports: z.array(z.string().trim().max(40)).max(8).optional(),
  deviceName: z.string().trim().max(120).optional(),
});

export const revokeDeviceSchema = z.object({
  deviceId: uuid,
});

export const trustDeviceSchema = z.object({
  deviceId: uuid,
  trusted: z.boolean(),
});

export const securityEventListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  type: z.enum(SECURITY_EVENT_TYPES).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

export const createSecurityAlertSchema = z.object({
  title: z.string().trim().min(2).max(200),
  body: z.string().trim().min(1).max(4_000),
  severity: z.enum(["info", "low", "medium", "high", "critical"]),
  eventType: z.enum(SECURITY_EVENT_TYPES).optional(),
});

export const updateSecurityAlertSchema = z.object({
  status: z.enum(SECURITY_ALERT_STATUSES),
  note: z.string().trim().max(2_000).optional(),
});

export const createVulnerabilitySchema = z.object({
  source: z.string().trim().min(2).max(80),
  identifier: z.string().trim().min(2).max(120),
  component: z.string().trim().max(200).optional(),
  severity: z.enum(["info", "low", "medium", "high", "critical"]),
  summary: z.string().trim().min(2).max(2_000),
});

export const updateVulnerabilitySchema = z.object({
  status: z.enum(SECURITY_VULNERABILITY_STATUSES),
  note: z.string().trim().max(2_000).optional(),
});

export const createPentestSchema = z.object({
  vendor: z.string().trim().min(2).max(120),
  startedAt: z.string().datetime({ offset: true }).optional(),
  scope: z.string().trim().max(2_000).optional(),
});

export const updatePentestSchema = z.object({
  status: z.enum(SECURITY_PENTEST_STATUSES),
  reportReference: z.string().trim().max(500).optional(),
  closedAt: z.string().datetime({ offset: true }).optional(),
});
