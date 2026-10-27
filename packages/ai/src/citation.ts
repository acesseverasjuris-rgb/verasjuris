import { createHash } from "node:crypto";
import { AppError } from "@verasjuris/types";
import { z } from "zod";

/**
 * Motor de citação: formata e valida fontes jurídicas verificáveis.
 * Nunca marca VERIFIED sem validação real. Fonte incompleta/alucinada → INVALID.
 */

export const CITATION_SOURCE_TYPES = [
  "legislation",
  "case_law",
  "summary",
  "theme",
  "precedent",
  "doctrine",
  "internal_document",
] as const;

export type CitationSourceType = (typeof CITATION_SOURCE_TYPES)[number];

export const CITATION_VERIFICATION_STATUSES = [
  "unverified",
  "source_available",
  "verified",
  "source_unavailable",
  "invalid",
  "stale",
] as const;

export type CitationVerificationStatus = (typeof CITATION_VERIFICATION_STATUSES)[number];

export const UNVERIFIED_SOURCE_LABEL = "Fonte não verificada.";

export type CitationInput = {
  sourceType: CitationSourceType;
  sourceId?: string | null;
  title?: string | null;
  court?: string | null;
  caseNumber?: string | null;
  rapporteur?: string | null;
  judgingBody?: string | null;
  decisionDate?: string | null;
  publicationDate?: string | null;
  legislationRef?: string | null;
  sourceUrl?: string | null;
  excerpt?: string | null;
  pageNumber?: number | null;
  contentHash?: string | null;
  provider?: string | null;
  /** Status informado por verificação real; o motor nunca promove a verified sozinho. */
  verificationStatus?: CitationVerificationStatus;
};

export type ResolvedCitation = {
  sourceType: CitationSourceType;
  sourceId: string | null;
  formattedCitation: string;
  court: string | null;
  caseNumber: string | null;
  rapporteur: string | null;
  judgingBody: string | null;
  decisionDate: string | null;
  publicationDate: string | null;
  legislationRef: string | null;
  sourceUrl: string | null;
  excerpt: string | null;
  pageNumber: number | null;
  contentHash: string | null;
  provider: string | null;
  verificationStatus: CitationVerificationStatus;
  incomplete: boolean;
  rejectionReason: string | null;
};

const optionalTrim = (value: string | null | undefined): string | null => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function hashExcerpt(excerpt: string | null): string | null {
  if (!excerpt) return null;
  return createHash("sha256").update(excerpt, "utf8").digest("hex");
}

/** Formatação assistiva de jurisprudência (não implica verificação). */
export function formatCaseLawCitation(input: {
  court?: string | null;
  caseNumber?: string | null;
  rapporteur?: string | null;
  decisionDate?: string | null;
  judgingBody?: string | null;
}): string {
  const parts: string[] = [];
  const court = optionalTrim(input.court);
  const number = optionalTrim(input.caseNumber);
  const body = optionalTrim(input.judgingBody);
  const rapporteur = optionalTrim(input.rapporteur);
  const date = optionalTrim(input.decisionDate);
  if (court) parts.push(court);
  if (body) parts.push(body);
  if (number) parts.push(number);
  if (rapporteur) parts.push(`Rel. ${rapporteur}`);
  if (date) parts.push(date);
  return parts.length > 0 ? parts.join(", ") : UNVERIFIED_SOURCE_LABEL;
}

/** Formatação assistiva de legislação (não implica verificação). */
export function formatLegislationCitation(input: {
  legislationRef?: string | null;
  title?: string | null;
  publicationDate?: string | null;
}): string {
  const ref = optionalTrim(input.legislationRef) ?? optionalTrim(input.title);
  const date = optionalTrim(input.publicationDate);
  if (!ref) return UNVERIFIED_SOURCE_LABEL;
  return date ? `${ref}, ${date}` : ref;
}

function detectIncomplete(input: CitationInput, sourceUrl: string | null): boolean {
  if (input.sourceType === "case_law") {
    return !optionalTrim(input.court) || !optionalTrim(input.caseNumber) || !sourceUrl;
  }
  if (input.sourceType === "legislation") {
    return !optionalTrim(input.legislationRef) && !optionalTrim(input.title);
  }
  if (input.sourceType === "internal_document") {
    return !optionalTrim(input.sourceId) && !optionalTrim(input.title);
  }
  return !optionalTrim(input.title) && !sourceUrl && !optionalTrim(input.sourceId);
}

function rejectHallucinated(input: CitationInput, sourceUrl: string | null): string | null {
  if (input.sourceType === "case_law") {
    if (!optionalTrim(input.court) || !optionalTrim(input.caseNumber) || !sourceUrl) {
      return UNVERIFIED_SOURCE_LABEL;
    }
  }
  if (sourceUrl && !isHttpsUrl(sourceUrl)) {
    return UNVERIFIED_SOURCE_LABEL;
  }
  if (
    input.verificationStatus === "verified" &&
    (detectIncomplete(input, sourceUrl) || !sourceUrl)
  ) {
    return UNVERIFIED_SOURCE_LABEL;
  }
  return null;
}

const citationInputSchema = z.object({
  sourceType: z.enum(CITATION_SOURCE_TYPES),
  sourceId: z.string().trim().min(1).max(200).nullable().optional(),
  title: z.string().trim().min(1).max(500).nullable().optional(),
  court: z.string().trim().min(1).max(120).nullable().optional(),
  caseNumber: z.string().trim().min(1).max(120).nullable().optional(),
  rapporteur: z.string().trim().min(1).max(200).nullable().optional(),
  judgingBody: z.string().trim().min(1).max(200).nullable().optional(),
  decisionDate: z.string().trim().min(1).max(40).nullable().optional(),
  publicationDate: z.string().trim().min(1).max(40).nullable().optional(),
  legislationRef: z.string().trim().min(1).max(300).nullable().optional(),
  sourceUrl: z.string().trim().min(1).max(2_000).nullable().optional(),
  excerpt: z.string().trim().min(1).max(8_000).nullable().optional(),
  pageNumber: z.number().int().positive().max(100_000).nullable().optional(),
  contentHash: z.string().trim().min(1).max(128).nullable().optional(),
  provider: z.string().trim().min(1).max(120).nullable().optional(),
  verificationStatus: z.enum(CITATION_VERIFICATION_STATUSES).optional(),
});

export class CitationEngine {
  /**
   * Resolve e valida metadata. Nunca promove para `verified` sem validação externa real
   * (status `verified` só é aceito se a entrada já vier de verificação comprovada e completa).
   */
  resolve(raw: CitationInput): ResolvedCitation {
    const parsed = citationInputSchema.safeParse(raw);
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Metadados de citação inválidos.");
    }
    const input = parsed.data;
    const sourceUrl = optionalTrim(input.sourceUrl ?? null);
    const excerpt = optionalTrim(input.excerpt ?? null);
    const contentHash = optionalTrim(input.contentHash ?? null) ?? hashExcerpt(excerpt);
    const incomplete = detectIncomplete(input, sourceUrl);
    const rejectionReason = rejectHallucinated(input, sourceUrl);

    let verificationStatus: CitationVerificationStatus = input.verificationStatus ?? "unverified";

    if (rejectionReason) {
      verificationStatus = "invalid";
    } else if (verificationStatus === "verified") {
      // Só preserva verified se a entrada já trouxe status verificado E está completa com URL.
      // O motor em si não realiza validação remota nesta etapa.
      if (incomplete || !sourceUrl) {
        verificationStatus = "invalid";
      }
    } else if (sourceUrl && !incomplete) {
      if (verificationStatus === "unverified") {
        verificationStatus = "source_available";
      }
    }

    const formattedCitation =
      verificationStatus === "invalid"
        ? UNVERIFIED_SOURCE_LABEL
        : input.sourceType === "legislation"
          ? formatLegislationCitation(input)
          : input.sourceType === "case_law"
            ? formatCaseLawCitation(input)
            : (optionalTrim(input.title) ??
              optionalTrim(input.legislationRef) ??
              UNVERIFIED_SOURCE_LABEL);

    return {
      sourceType: input.sourceType,
      sourceId: optionalTrim(input.sourceId ?? null),
      formattedCitation,
      court: optionalTrim(input.court ?? null),
      caseNumber: optionalTrim(input.caseNumber ?? null),
      rapporteur: optionalTrim(input.rapporteur ?? null),
      judgingBody: optionalTrim(input.judgingBody ?? null),
      decisionDate: optionalTrim(input.decisionDate ?? null),
      publicationDate: optionalTrim(input.publicationDate ?? null),
      legislationRef: optionalTrim(input.legislationRef ?? null),
      sourceUrl,
      excerpt,
      pageNumber: input.pageNumber ?? null,
      contentHash,
      provider: optionalTrim(input.provider ?? null),
      verificationStatus,
      incomplete: incomplete || verificationStatus === "invalid",
      rejectionReason,
    };
  }

  /** Atalho: formata e rejeita entradas não verificáveis. */
  format(raw: CitationInput): ResolvedCitation {
    return this.resolve(raw);
  }
}

/**
 * Interface futura para inserção de citações verificadas em minutas.
 * NÃO implementar peticionamento automático nesta etapa.
 */
export interface CitationInsertionService {
  /**
   * Insere citação já verificada em um rascunho/minuta.
   * Implementações futuras devem recusar citations com status diferente de `verified`.
   */
  insertVerifiedCitation(input: {
    draftId: string;
    citation: ResolvedCitation;
    position?: { offset: number } | null;
  }): Promise<{ draftId: string; inserted: boolean }>;
}

/** Stub: peticionamento automático não está disponível. */
export class NotImplementedCitationInsertionService implements CitationInsertionService {
  insertVerifiedCitation(_input: {
    draftId: string;
    citation: ResolvedCitation;
    position?: { offset: number } | null;
  }): Promise<{ draftId: string; inserted: boolean }> {
    return Promise.reject(
      new AppError(
        "NOT_CONFIGURED",
        "Inserção automática de citações em petições não está disponível nesta etapa.",
      ),
    );
  }
}
