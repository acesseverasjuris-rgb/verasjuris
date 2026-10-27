import { AppError } from "@verasjuris/types";
import { z } from "zod";

/**
 * Provedor de oportunidades públicas (licitações, chamamentos, credenciamentos…).
 * Nenhuma fonte externa está integrada: `NotConfiguredPublicOpportunityProvider` recusa com
 * `PUBLIC_OPPORTUNITY_PROVIDER_NOT_CONFIGURED`. Cadastro manual continua disponível no domínio.
 */

/** Espelha `public_opportunity_type` / `public_opportunity_status` do banco. */
export const PUBLIC_OPPORTUNITY_TYPES = [
  "tender",
  "public_call",
  "accreditation",
  "partnership",
  "concession",
  "grant",
  "program",
  "notice",
  "other",
] as const;

export const PUBLIC_OPPORTUNITY_STATUSES = [
  "draft",
  "published",
  "open",
  "closed",
  "cancelled",
  "archived",
] as const;

export type PublicOpportunityType = (typeof PUBLIC_OPPORTUNITY_TYPES)[number];
export type PublicOpportunityStatus = (typeof PUBLIC_OPPORTUNITY_STATUSES)[number];

export const publicOpportunityCandidateSchema = z.object({
  /** Identificador estável na fonte; usado como `sourceReference`. */
  externalId: z.string().trim().min(1).max(200),
  opportunityType: z.enum(PUBLIC_OPPORTUNITY_TYPES),
  title: z.string().trim().min(1).max(500),
  object: z.string().trim().min(1).max(8000),
  description: z.string().trim().max(20_000).optional(),
  publicBodyName: z.string().trim().max(300).optional(),
  processNumber: z.string().trim().max(120).optional(),
  procurementNumber: z.string().trim().max(120).optional(),
  modality: z.string().trim().max(120).optional(),
  /** Valor estimado em centavos inteiros. */
  estimatedValueCents: z.number().int().nonnegative().safe().optional(),
  currency: z.string().trim().length(3).default("BRL"),
  publicationDate: z.string().datetime({ offset: true }).optional(),
  proposalDeadline: z.string().datetime({ offset: true }).optional(),
  status: z.enum(PUBLIC_OPPORTUNITY_STATUSES).default("published"),
  stateCode: z.string().trim().length(2).optional(),
  municipality: z.string().trim().max(200).optional(),
  sourceUrl: z
    .string()
    .url()
    .refine((value) => value.startsWith("https://"), "A URL da fonte deve usar https.")
    .optional(),
});

export type PublicOpportunityCandidate = z.infer<typeof publicOpportunityCandidateSchema>;

export type PublicOpportunityQuery = {
  text?: string;
  opportunityTypes?: readonly PublicOpportunityType[];
  stateCode?: string;
  publishedFrom?: string;
  publishedTo?: string;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
};

export type PublicOpportunityPage = {
  provider: string;
  items: PublicOpportunityCandidate[];
  nextCursor: string | null;
};

export type PublicOpportunityHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export interface PublicOpportunityProvider {
  readonly id: string;
  search(query: PublicOpportunityQuery): Promise<PublicOpportunityPage>;
  getByExternalId?(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<PublicOpportunityCandidate | null>;
  healthCheck(): Promise<PublicOpportunityHealth>;
}

const NOT_CONFIGURED_MESSAGE =
  "Nenhum provedor de oportunidades públicas está configurado. Use o cadastro manual.";

export class NotConfiguredPublicOpportunityProvider implements PublicOpportunityProvider {
  readonly id = "not_configured";

  search(_query: PublicOpportunityQuery): Promise<PublicOpportunityPage> {
    return Promise.reject(
      new AppError("PUBLIC_OPPORTUNITY_PROVIDER_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE),
    );
  }

  getByExternalId(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<PublicOpportunityCandidate | null> {
    return Promise.reject(
      new AppError("PUBLIC_OPPORTUNITY_PROVIDER_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE),
    );
  }

  healthCheck(): Promise<PublicOpportunityHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Nenhum provedor de oportunidades públicas configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
