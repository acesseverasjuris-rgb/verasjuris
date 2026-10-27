import { describe, expect, it } from "vitest";
import {
  DEFAULT_AI_FEATURES,
  LEGAL_COMPARISON_FEATURE,
  LEGAL_COMPARISON_TYPES,
  LEGAL_DRAFT_FEATURES,
  legalComparisonOutputSchema,
  legalDraftOutputSchema,
  PAGE_MAPPING_NOT_AVAILABLE,
  sanitizeExportHtml,
  splitPlainTextPagesByFormFeed,
  TemplateVariableResolver,
} from "./index.js";
import { legalComparisonFixture, legalDraftFixture } from "./testing.js";

describe("Etapa 8 — template variables (injection)", () => {
  const resolver = new TemplateVariableResolver({
    allowedPaths: ["party.name", "matter.title", "nested.value"],
  });

  it("resolve caminhos whitelist e marca missing", () => {
    const result = resolver.resolveTemplate(
      "Olá {{party.name}} — {{matter.title}} — {{nested.value}}",
      { party: { name: "Ana" }, matter: { title: "Ação X" } },
    );
    expect(result.rendered).toContain("Ana");
    expect(result.rendered).toContain("Ação X");
    expect(result.rendered).toContain("⟦MISSING_VARIABLE:nested.value⟧");
    expect(result.missingVariables).toEqual(["nested.value"]);
    expect(result.blockedExpressions).toEqual([]);
  });

  it("rejeita expressões maliciosas e fora da whitelist", () => {
    const content =
      "x {{party.name.__proto__}} y {{constructor}} z {{party.name.constructor}} " +
      "w {{evil.path}} v {{party.name; process.exit()}} u {{a[0]}}";
    const result = resolver.resolveTemplate(content, { party: { name: "Ana" } });
    expect(result.blockedExpressions.length).toBeGreaterThanOrEqual(4);
    expect(result.rendered).toContain("{{party.name.__proto__}}");
    expect(result.rendered).toContain("{{evil.path}}");
    expect(result.missingVariables).toEqual([]);
  });

  it("não avalia código em expressões", () => {
    const result = resolver.resolveTemplate("{{party.name}}", {
      party: { name: "{{constructor}}" },
    });
    expect(result.rendered).toBe("{{constructor}}");
    expect(result.blockedExpressions).toEqual([]);
  });
});

describe("Etapa 8 — legal_draft schema", () => {
  it("registra todas as features legal_draft.* no gateway", () => {
    for (const feature of LEGAL_DRAFT_FEATURES) {
      expect(DEFAULT_AI_FEATURES[feature]?.outputDisposition).toBe("requires_review");
      expect(DEFAULT_AI_FEATURES[feature]?.requires).toContain("STRUCTURED_OUTPUT");
    }
  });

  it("aceita fixture estruturada e rejeita citation inventada via filtro vazio", () => {
    const ok = legalDraftOutputSchema.safeParse(legalDraftFixture());
    expect(ok.success).toBe(true);

    const withCitation = legalDraftFixture({
      suggestedCitations: [{ sourceId: "src-1", confidence: 80 }],
    });
    expect(legalDraftOutputSchema.safeParse(withCitation).success).toBe(true);

    const invalid = legalDraftOutputSchema.safeParse({
      ...legalDraftFixture(),
      confidence: 101,
    });
    expect(invalid.success).toBe(false);
  });
});

describe("Etapa 8 — legal_comparison schema", () => {
  it("registra legal_comparison no gateway", () => {
    expect(DEFAULT_AI_FEATURES[LEGAL_COMPARISON_FEATURE]?.outputDisposition).toBe(
      "requires_review",
    );
  });

  it("exige provenance e cobre os tipos", () => {
    expect(LEGAL_COMPARISON_TYPES).toHaveLength(5);
    const ok = legalComparisonOutputSchema.safeParse(legalComparisonFixture());
    expect(ok.success).toBe(true);

    const missingProvenance = {
      ...legalComparisonFixture(),
      items: [
        {
          category: "facts",
          sourceA: "A",
          sourceB: "B",
          finding: "achado",
          severity: "low",
          confidence: 50,
        },
      ],
    };
    expect(legalComparisonOutputSchema.safeParse(missingProvenance).success).toBe(false);
  });
});

describe("Etapa 8 — page mapping honesty + HTML sanitize", () => {
  it("faz split seguro por form-feed em texto plano", () => {
    const pages = splitPlainTextPagesByFormFeed("pág 1\fpág 2\f");
    expect(pages).toEqual([
      { pageNumber: 1, text: "pág 1" },
      { pageNumber: 2, text: "pág 2" },
    ]);
  });

  it("expõe PAGE_MAPPING_NOT_AVAILABLE", () => {
    expect(PAGE_MAPPING_NOT_AVAILABLE).toBe("PAGE_MAPPING_NOT_AVAILABLE");
  });

  it("sanitiza HTML perigoso na exportação", () => {
    const dirty =
      '<p onclick="alert(1)">ok</p><script>evil()</script><a href="javascript:alert(1)">x</a>';
    const clean = sanitizeExportHtml(dirty);
    expect(clean).not.toMatch(/script/i);
    expect(clean).not.toMatch(/onclick/i);
    expect(clean).not.toMatch(/javascript:/i);
    expect(clean).toContain("ok");
  });
});
