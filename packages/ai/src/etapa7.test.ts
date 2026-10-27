import { AppError } from "@verasjuris/types";
import { describe, expect, it } from "vitest";
import {
  CitationEngine,
  DEFAULT_AI_FEATURES,
  estimateAuctionCost,
  legalReviewOutputSchema,
  NotConfiguredAuctionProvider,
  ResearchGateway,
  UNVERIFIED_SOURCE_LABEL,
} from "./index.js";
import { legalReviewFixture } from "./testing.js";

describe("Etapa 7 — ResearchGateway", () => {
  it("permanece NOT_CONFIGURED sem provedor e não inventa resultados", async () => {
    const gateway = new ResearchGateway();
    expect(gateway.describe()).toEqual({ status: "not_configured", provider: null });
    expect((await gateway.healthCheck()).status).toBe("not_configured");
    await expect(gateway.search({ text: "súmula vinculante" })).rejects.toMatchObject({
      code: "LEGAL_SOURCE_PROVIDER_NOT_CONFIGURED",
    });
  });
});

describe("Etapa 7.1 — CitationEngine", () => {
  const engine = new CitationEngine();

  it("rejeita jurisprudência incompleta/alucinada como INVALID", () => {
    const result = engine.resolve({
      sourceType: "case_law",
      title: "Acórdão inventado",
      // sem court, caseNumber, sourceUrl
    });
    expect(result.verificationStatus).toBe("invalid");
    expect(result.formattedCitation).toBe(UNVERIFIED_SOURCE_LABEL);
    expect(result.rejectionReason).toBe(UNVERIFIED_SOURCE_LABEL);
    expect(result.incomplete).toBe(true);
  });

  it("nunca promove para verified sem validação completa", () => {
    const result = engine.resolve({
      sourceType: "case_law",
      court: "STJ",
      caseNumber: "REsp 1",
      verificationStatus: "verified",
      // sem sourceUrl → inválido
    });
    expect(result.verificationStatus).toBe("invalid");
    expect(result.formattedCitation).toBe(UNVERIFIED_SOURCE_LABEL);
  });

  it("preserva URL, trecho e hash quando a fonte é completa", () => {
    const result = engine.resolve({
      sourceType: "case_law",
      court: "STJ",
      caseNumber: "REsp 123456/SP",
      rapporteur: "Min. Exemplo",
      sourceUrl: "https://example.gov.br/acordao/123",
      excerpt: "Trecho utilizado na análise.",
      verificationStatus: "unverified",
    });
    expect(result.verificationStatus).toBe("source_available");
    expect(result.sourceUrl).toBe("https://example.gov.br/acordao/123");
    expect(result.excerpt).toBe("Trecho utilizado na análise.");
    expect(result.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.formattedCitation).toContain("STJ");
    expect(result.formattedCitation).toContain("REsp 123456/SP");
  });
});

describe("Etapa 8 — Auction cost estimator", () => {
  it("calcula centavos e basis points sem float", () => {
    const estimate = estimateAuctionCost({
      bidCents: 1_000_00,
      commissionBasisPoints: 500, // 5%
      knownFeesCents: 2_500,
      informedCostsCents: 1_500,
    });
    expect(estimate.commissionCents).toBe(5_000); // 5% de 100000
    expect(estimate.totalCents).toBe(1_000_00 + 5_000 + 2_500 + 1_500);
    expect(estimate.label).toBe("Estimativa com base nos valores informados.");
    expect(Number.isSafeInteger(estimate.totalCents)).toBe(true);
  });

  it("recusa valores não inteiros ou negativos", () => {
    expect(() => estimateAuctionCost({ bidCents: 10.5, commissionBasisPoints: 100 })).toThrow(
      AppError,
    );
    expect(() => estimateAuctionCost({ bidCents: -1, commissionBasisPoints: 100 })).toThrow(
      AppError,
    );
  });
});

describe("Etapa 6.3 — Legal review schema", () => {
  it("valida fixture estruturada", () => {
    const parsed = legalReviewOutputSchema.safeParse(legalReviewFixture());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.schemaVersion).toBe("1");
      expect(parsed.data.risks[0]?.requiresHumanReview).toBe(true);
      expect(parsed.data.missingDocuments[0]?.description).toMatch(/não localizado/i);
    }
  });

  it("rejeita risco sem requiresHumanReview", () => {
    const invalid = legalReviewFixture({
      risks: [
        {
          category: "deadline",
          description: "possível risco",
          severity: "low",
          confidence: 10,
          // @ts-expect-error — exige literal true
          requiresHumanReview: false,
          relatedDocuments: [],
        },
      ],
    });
    expect(legalReviewOutputSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("Etapa 8 — AuctionProvider", () => {
  it("healthCheck informa not_configured", async () => {
    const provider = new NotConfiguredAuctionProvider();
    const health = await provider.healthCheck();
    expect(health.status).toBe("not_configured");
    await expect(provider.listAuctions({})).rejects.toMatchObject({
      code: "AUCTION_PROVIDER_NOT_CONFIGURED",
    });
  });
});

describe("DEFAULT_AI_FEATURES — etapa 6.3/8", () => {
  it("registra legal_review e features de leilão com requires_review", () => {
    expect(DEFAULT_AI_FEATURES.legal_review?.outputDisposition).toBe("requires_review");
    expect(DEFAULT_AI_FEATURES["auction.notice_analysis"]?.outputDisposition).toBe(
      "requires_review",
    );
    expect(DEFAULT_AI_FEATURES["auction.risk_extraction"]?.outputDisposition).toBe(
      "requires_review",
    );
    expect(DEFAULT_AI_FEATURES["auction.document_summary"]?.outputDisposition).toBe(
      "requires_review",
    );
    expect(DEFAULT_AI_FEATURES["auction.due_diligence_assist"]?.outputDisposition).toBe(
      "requires_review",
    );
  });
});
