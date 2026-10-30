import { z } from "zod";

export const SSO_PROTOCOLS = ["saml", "oidc"] as const;
export const ENTERPRISE_SSO_STATUSES = ["draft", "active", "disabled", "not_configured"] as const;

export const createEnterpriseSsoConfigSchema = z.object({
  protocol: z.enum(SSO_PROTOCOLS),
  issuer: z.string().trim().min(2).max(500),
  metadataUrl: z.string().trim().url().max(1_000).optional(),
  clientId: z.string().trim().max(200).optional(),
  /** Referência a secret — nunca o valor plaintext. */
  clientSecretReference: z.string().trim().max(200).optional(),
  certificateReference: z.string().trim().max(200).optional(),
  enabled: z.boolean().default(false),
});

export const updateEnterpriseSsoConfigSchema = createEnterpriseSsoConfigSchema.partial();

export const createScimConfigSchema = z.object({
  enabled: z.boolean().default(false),
  bearerTokenReference: z.string().trim().min(2).max(200),
  baseUrl: z.string().trim().url().max(500).optional(),
});

export const updateOrganizationSecurityPolicySchema = z.object({
  mfaPolicy: z
    .enum(["optional", "required_admin", "required_sensitive", "required_all"])
    .optional(),
  sessionTimeoutMinutes: z.number().int().min(5).max(10080).optional(),
  ssoRequired: z.boolean().optional(),
  allowedAuthMethods: z
    .array(z.enum(["password", "sso", "passkey"]))
    .min(1)
    .max(3)
    .optional(),
  ipAllowlist: z.array(z.string().trim().max(80)).max(100).optional(),
  apiPolicyNotes: z.string().trim().max(2_000).optional(),
});

export const createEnterpriseSlaSchema = z.object({
  name: z.string().trim().min(2).max(120),
  availabilityTargetPercent: z.number().min(90).max(100),
  responseTimeHours: z.number().int().min(1).max(720).optional(),
  notes: z.string().trim().max(2_000).optional(),
});

export const updateEnterpriseBrandingSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  primaryColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Informe uma cor hexadecimal válida.")
    .optional(),
  logoAssetId: z.string().uuid().optional(),
  /** CSS/JS arbitrário é proibido — apenas tokens seguros. */
  customCssForbidden: z.literal(true).optional(),
});
