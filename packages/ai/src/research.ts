import { AppError } from "@verasjuris/types";
import { z } from "zod";

/**
 * Pesquisa jurídica via fontes verificáveis.
 * A IA NÃO pode “lembrar” jurisprudência como fonte: todo resultado passa por
 * LegalSourceProvider → ResearchGateway → normalização/proveniência → CitationEngine.
 * Sem provider configurado: NOT_CONFIGURED (sem resultados inventados).
 */

export const LEGAL_SOURCE_CAPABILITIES = [
  "LEGISLATION",
  "CASE_LAW",
  "SUMULA",
  "REPETITIVE_THEME",
  "GENERAL_REPERCUSSION",
  "PRECEDENT",
  "DOCTRINE",
] as const;

export type LegalSourceCapability = (typeof LEGAL_SOURCE_CAPABILITIES)[number];

export const legalSourceCapabilitySchema = z.enum(LEGAL_SOURCE_CAPABILITIES);

export type LegalResearchQueryFilters = {
  capabilities?: readonly LegalSourceCapability[];
  court?: string;
  jurisdiction?: string;
  dateFrom?: string;
  dateTo?: string;
  language?: string;
};

export type LegalResearchQuery = {
  text: string;
  filters?: LegalResearchQueryFilters;
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
};

/** Resultado normalizado com proveniência obrigatória. */
export type NormalizedLegalSourceResult = {
  /** Identificador estável na fonte externa ou local. */
  externalId: string;
  capability: LegalSourceCapability;
  title: string;
  excerpt: string | null;
  court: string | null;
  caseNumber: string | null;
  rapporteur: string | null;
  decisionDate: string | null;
  publicationDate: string | null;
  /** URL https da fonte, quando houver. */
  sourceUrl: string | null;
  provider: string;
  /** Hash do conteúdo/trecho para integridade. */
  contentHash: string | null;
  metadata: Record<string, string>;
};

export type LegalResearchPage = {
  provider: string;
  items: NormalizedLegalSourceResult[];
  nextCursor: string | null;
  /** Proveniência da busca (query normalizada + provider). */
  provenance: {
    queryText: string;
    filters: LegalResearchQueryFilters;
    retrievedAt: string;
  };
};

export type LegalSourceHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
  capabilities?: readonly LegalSourceCapability[];
};

export interface LegalSourceProvider {
  readonly id: string;
  readonly capabilities: readonly LegalSourceCapability[];
  search(query: LegalResearchQuery): Promise<LegalResearchPage>;
  fetchById(externalId: string, signal?: AbortSignal): Promise<NormalizedLegalSourceResult | null>;
  healthCheck(): Promise<LegalSourceHealth>;
}

const NOT_CONFIGURED_MESSAGE =
  "Nenhum provedor de fontes jurídicas está configurado. Nenhum resultado de pesquisa foi inventado.";

export class NotConfiguredLegalSourceProvider implements LegalSourceProvider {
  readonly id = "not_configured";
  readonly capabilities: readonly LegalSourceCapability[] = [];

  search(_query: LegalResearchQuery): Promise<LegalResearchPage> {
    return Promise.reject(
      new AppError("LEGAL_SOURCE_PROVIDER_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE),
    );
  }

  fetchById(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<NormalizedLegalSourceResult | null> {
    return Promise.reject(
      new AppError("LEGAL_SOURCE_PROVIDER_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE),
    );
  }

  healthCheck(): Promise<LegalSourceHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Nenhum provedor de fontes jurídicas configurado.",
      checkedAt: new Date().toISOString(),
      capabilities: [],
    });
  }
}

const querySchema = z.object({
  text: z.string().trim().min(1).max(2_000),
  filters: z
    .object({
      capabilities: z.array(legalSourceCapabilitySchema).max(10).optional(),
      court: z.string().trim().min(1).max(120).optional(),
      jurisdiction: z.string().trim().min(1).max(120).optional(),
      dateFrom: z.string().trim().min(1).max(40).optional(),
      dateTo: z.string().trim().min(1).max(40).optional(),
      language: z.string().trim().min(2).max(16).optional(),
    })
    .strict()
    .optional(),
  cursor: z.string().trim().min(1).max(500).optional(),
  limit: z.number().int().positive().max(100).optional(),
});

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function dedupeKey(item: NormalizedLegalSourceResult): string {
  return [
    item.provider,
    item.capability,
    item.externalId,
    item.caseNumber ?? "",
    item.sourceUrl ?? "",
    item.contentHash ?? "",
  ].join("|");
}

function normalizeResult(item: NormalizedLegalSourceResult): NormalizedLegalSourceResult {
  return {
    ...item,
    externalId: normalizeWhitespace(item.externalId),
    title: normalizeWhitespace(item.title),
    excerpt: item.excerpt ? normalizeWhitespace(item.excerpt) : null,
    court: item.court ? normalizeWhitespace(item.court) : null,
    caseNumber: item.caseNumber ? normalizeWhitespace(item.caseNumber) : null,
    rapporteur: item.rapporteur ? normalizeWhitespace(item.rapporteur) : null,
    sourceUrl: item.sourceUrl?.trim() || null,
  };
}

function dedupeResults(
  items: readonly NormalizedLegalSourceResult[],
): NormalizedLegalSourceResult[] {
  const seen = new Set<string>();
  const out: NormalizedLegalSourceResult[] = [];
  for (const raw of items) {
    const item = normalizeResult(raw);
    const key = dedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export type ResearchGatewayOptions = {
  provider?: LegalSourceProvider;
  providers?: Readonly<Record<string, LegalSourceProvider>>;
  providerId?: string;
  now?: () => Date;
};

export type ResearchGatewayDescription =
  | { status: "not_configured"; provider: null }
  | {
      status: "configured";
      provider: string;
      capabilities: readonly LegalSourceCapability[];
    };

/**
 * Gateway de pesquisa jurídica. Domínios usam somente este gateway — nunca
 * inventam jurisprudência nem chamam fontes externas diretamente.
 */
export class ResearchGateway {
  private readonly provider: LegalSourceProvider | null;
  private readonly now: () => Date;

  constructor(options: ResearchGatewayOptions = {}) {
    this.provider = ResearchGateway.selectProvider(options);
    this.now = options.now ?? (() => new Date());
  }

  private static selectProvider(options: ResearchGatewayOptions): LegalSourceProvider | null {
    let chosen: LegalSourceProvider | undefined = options.provider;
    if (!chosen && options.providers && options.providerId) {
      chosen = options.providers[options.providerId];
      if (!chosen && options.providerId !== "not_configured") {
        throw new AppError(
          "VALIDATION_ERROR",
          `Provedor de fontes jurídicas desconhecido: ${options.providerId}.`,
        );
      }
    }
    if (!chosen || chosen instanceof NotConfiguredLegalSourceProvider) return null;
    return chosen;
  }

  describe(): ResearchGatewayDescription {
    if (!this.provider) return { status: "not_configured", provider: null };
    return {
      status: "configured",
      provider: this.provider.id,
      capabilities: this.provider.capabilities,
    };
  }

  async healthCheck(): Promise<LegalSourceHealth> {
    if (!this.provider) {
      return {
        status: "not_configured",
        detail: "Nenhum provedor de fontes jurídicas configurado.",
        checkedAt: this.now().toISOString(),
        capabilities: [],
      };
    }
    return this.provider.healthCheck();
  }

  private requireProvider(): LegalSourceProvider {
    if (!this.provider) {
      throw new AppError("LEGAL_SOURCE_PROVIDER_NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
    }
    return this.provider;
  }

  private validateQuery(raw: LegalResearchQuery): Omit<LegalResearchQuery, "signal"> {
    const parsed = querySchema.safeParse({
      text: raw.text,
      ...(raw.filters ? { filters: raw.filters } : {}),
      ...(raw.cursor ? { cursor: raw.cursor } : {}),
      ...(raw.limit !== undefined ? { limit: raw.limit } : {}),
    });
    if (!parsed.success) {
      throw new AppError("VALIDATION_ERROR", "Consulta de pesquisa jurídica inválida.", [
        ...parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: "Valor inválido.",
        })),
      ]);
    }
    return {
      text: normalizeWhitespace(parsed.data.text),
      ...(parsed.data.filters ? { filters: parsed.data.filters } : {}),
      ...(parsed.data.cursor ? { cursor: parsed.data.cursor } : {}),
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
    };
  }

  async search(raw: LegalResearchQuery): Promise<LegalResearchPage> {
    const provider = this.requireProvider();
    const query = this.validateQuery(raw);
    if (query.filters?.capabilities?.length) {
      const unsupported = query.filters.capabilities.filter(
        (capability) => !provider.capabilities.includes(capability),
      );
      if (unsupported.length > 0) {
        throw new AppError(
          "NOT_CONFIGURED",
          `O provedor de fontes não oferece a capacidade: ${unsupported.join(", ")}.`,
        );
      }
    }
    const page = await provider.search({
      ...query,
      ...(raw.signal ? { signal: raw.signal } : {}),
    });
    const filters = query.filters ?? {};
    return {
      provider: page.provider || provider.id,
      items: dedupeResults(page.items),
      nextCursor: page.nextCursor,
      provenance: {
        queryText: query.text,
        filters,
        retrievedAt: this.now().toISOString(),
      },
    };
  }

  async fetchById(
    externalId: string,
    signal?: AbortSignal,
  ): Promise<NormalizedLegalSourceResult | null> {
    const provider = this.requireProvider();
    const id = normalizeWhitespace(externalId);
    if (!id) {
      throw new AppError("VALIDATION_ERROR", "Identificador de fonte jurídica inválido.");
    }
    const result = await provider.fetchById(id, signal);
    return result ? normalizeResult(result) : null;
  }
}

export type ResearchGatewayEnvConfig = {
  LEGAL_SOURCE_PROVIDER?: string;
};

/**
 * Fábrica a partir do ambiente. Padrão: not_configured (sem fontes externas).
 */
export function createResearchGatewayFromEnv(
  env: ResearchGatewayEnvConfig = {},
  extra: Pick<ResearchGatewayOptions, "providers" | "now"> = {},
): ResearchGateway {
  return new ResearchGateway({
    ...extra,
    providerId: env.LEGAL_SOURCE_PROVIDER ?? "not_configured",
    providers: extra.providers ?? {
      not_configured: new NotConfiguredLegalSourceProvider(),
    },
  });
}
