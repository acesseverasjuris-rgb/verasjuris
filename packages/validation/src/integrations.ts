import { z } from "zod";

export const INTEGRATION_CREDENTIAL_STATUSES = [
  "active",
  "rotated",
  "expired",
  "disabled",
  "not_configured",
] as const;

export const PROVIDER_CONFIG_STATUSES = [
  "configured",
  "not_configured",
  "degraded",
  "failed",
  "disabled",
] as const;

export const PUBLIC_API_WEBHOOK_EVENTS = [
  "client.updated",
  "matter.updated",
  "document.uploaded",
  "deadline.due",
  "payment.updated",
  "analytics.export.ready",
] as const;

export const createIntegrationCredentialSchema = z.object({
  providerKey: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/, "Informe uma chave de provedor válida."),
  /** Referência ao secret manager — nunca o segredo em plaintext. */
  credentialReference: z.string().trim().min(2).max(200),
  environment: z.enum(["development", "staging", "production"]).default("production"),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

export const rotateIntegrationCredentialSchema = z.object({
  credentialReference: z.string().trim().min(2).max(200),
  expiresAt: z.string().datetime({ offset: true }).optional(),
});

export const createPublicApiWebhookEndpointSchema = z.object({
  url: z.string().trim().url().max(1_000),
  /** Referência ao segredo de assinatura — nunca plaintext. */
  secretReference: z.string().trim().min(2).max(200),
  events: z.array(z.enum(PUBLIC_API_WEBHOOK_EVENTS)).min(1).max(20),
  active: z.boolean().default(true),
  retryMaxAttempts: z.number().int().min(0).max(10).default(3),
});

export const updatePublicApiWebhookEndpointSchema = createPublicApiWebhookEndpointSchema.partial();

export const providerRegistryQuerySchema = z.object({
  type: z.string().trim().max(80).optional(),
  status: z.enum(PROVIDER_CONFIG_STATUSES).optional(),
});

export const integrationSyncRequestSchema = z.object({
  providerKey: z.string().trim().min(2).max(80),
  since: z.string().datetime({ offset: true }).optional(),
  dryRun: z.boolean().default(false),
});
