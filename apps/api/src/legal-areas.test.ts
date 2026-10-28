import { auditEvents } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { seedReferenceData } from "@verasjuris/database";
import { MemoryEmailProvider } from "@verasjuris/email";
import { and, eq, like } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import {
  getFeaturesForArea,
  hasFeature,
  LEGAL_AREA_FEATURES,
} from "./modules/legal-areas/registry.js";
import { call } from "./test-helpers.js";

describe("Etapa 12 — núcleo jurídico comum (Legal Areas API)", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let s: Etapa6Setup;
  let clientId: string;
  let civilModuleId: string;
  let familyModuleId: string;

  const root = (org = s?.orgA) => `/v1/organizations/${org}`;
  const matter = (id = s?.matterAId) => `${root()}/legal-matters/${id}`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
    });
    s = await bootstrapEtapa6(app, email, "legal-areas");

    const matterRes = await call(
      app,
      "GET",
      `${root()}/matters/${s.matterAId}`,
      undefined,
      s.ownerA,
    );
    expect(matterRes.statusCode).toBe(200);
    clientId = matterRes.json<{ matter: { clientId: string } }>().matter.clientId;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("registry in-memory: features por área", () => {
    expect(getFeaturesForArea("TAX")).toContain("tax_calculation");
    expect(hasFeature("FAMILY", "custody")).toBe(true);
    expect(hasFeature("FAMILY", "tax_calculation")).toBe(false);
    expect(Object.keys(LEGAL_AREA_FEATURES).length).toBe(17);
  });

  it("seed de módulos SYSTEM na primeira listagem", async () => {
    const listed = await call(app, "GET", `${root()}/legal-area-modules`, undefined, s.ownerA);
    expect(listed.statusCode).toBe(200);
    const body = listed.json<{ items: Array<{ key: string }>; total: number }>();
    expect(body.total).toBe(17);
    expect(body.items.some((m) => m.key === "CIVIL")).toBe(true);
    expect(body.items.some((m) => m.key === "TAX")).toBe(true);

    const civil = await call(app, "GET", `${root()}/legal-area-modules/CIVIL`, undefined, s.ownerA);
    expect(civil.statusCode).toBe(200);
    civilModuleId = civil.json<{ module: { id: string; features: string[] } }>().module.id;
    expect(civil.json<{ module: { features: string[] } }>().module.features).toContain(
      "civil_claim",
    );

    const features = await call(
      app,
      "GET",
      `${root()}/legal-area-modules/TAX/features`,
      undefined,
      s.ownerA,
    );
    expect(features.statusCode).toBe(200);
    const taxFeatures = features.json<{ items: Array<{ featureKey: string }> }>().items;
    expect(taxFeatures.some((f) => f.featureKey === "tax_credit")).toBe(true);
  });

  it("checklists de sistema e criação org", async () => {
    const list = await call(app, "GET", `${root()}/legal-area-checklists`, undefined, s.ownerA);
    expect(list.statusCode).toBe(200);
    const keys = list.json<{ items: Array<{ key: string }> }>().items.map((i) => i.key);
    expect(keys).toContain("FAMILY_DIVORCE");
    expect(keys).toContain("CRIMINAL_DEFENSE");
    expect(keys).toContain("MEDICAL_HOME_CARE");
    expect(keys).toContain("ENVIRONMENTAL_FINE");

    const family = await call(
      app,
      "GET",
      `${root()}/legal-area-modules/FAMILY`,
      undefined,
      s.ownerA,
    );
    familyModuleId = family.json<{ module: { id: string } }>().module.id;

    const created = await call(
      app,
      "POST",
      `${root()}/legal-area-checklists`,
      {
        moduleId: familyModuleId,
        key: "CUSTOM_FAMILY",
        title: "Checklist customizado",
        items: [{ key: "a", label: "Item A", required: true }],
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
  });

  it("template pack, workflow e rule set versionado", async () => {
    const pack = await call(
      app,
      "POST",
      `${root()}/legal-area-template-packs`,
      {
        moduleId: civilModuleId,
        packKey: "civil-basic",
        title: "Pack cível básico",
      },
      s.ownerA,
    );
    expect(pack.statusCode).toBe(201);

    const workflow = await call(
      app,
      "POST",
      `${root()}/legal-area-workflow-configs`,
      {
        moduleId: civilModuleId,
        key: "civil-default",
        title: "Fluxo cível",
        stages: [{ key: "draft", label: "Rascunho", order: 0 }],
      },
      s.ownerA,
    );
    expect(workflow.statusCode).toBe(201);

    const ruleSet = await call(
      app,
      "POST",
      `${root()}/versioned-rule-sets`,
      {
        key: "civil-damages",
        domain: "civil",
        version: "2024.1",
        effectiveFrom: "2024-01-01T00:00:00.000Z",
      },
      s.ownerA,
    );
    expect(ruleSet.statusCode).toBe(201);
  });

  it("binding de módulo ao LegalMatter", async () => {
    const binding = await call(
      app,
      "POST",
      `${matter()}/area-bindings`,
      { moduleId: civilModuleId, confidentiality: "standard" },
      s.ownerA,
    );
    expect(binding.statusCode).toBe(201);

    const list = await call(app, "GET", `${matter()}/area-bindings`, undefined, s.ownerA);
    expect(list.statusCode).toBe(200);
    expect(list.json<{ items: unknown[] }>().items.length).toBeGreaterThanOrEqual(1);
  });

  it("membro sem legal_area_module.manage não cria feature", async () => {
    const denied = await call(
      app,
      "POST",
      `${root()}/legal-area-modules/CIVIL/features`,
      { featureKey: "custom_feature" },
      s.memberA,
    );
    expect(denied.statusCode).toBe(403);

    const ok = await call(
      app,
      "POST",
      `${root()}/legal-area-modules/CIVIL/features`,
      { featureKey: "custom_feature_owner" },
      s.ownerA,
    );
    expect(ok.statusCode).toBe(201);
  });

  it("provedores de área NOT_CONFIGURED", async () => {
    const status = await call(app, "GET", `${root()}/area-providers/status`, undefined, s.ownerA);
    expect(status.statusCode).toBe(200);
    const body = status.json<{
      electoral: { status: string };
      environmental: { status: string };
      registry: { status: string };
    }>();
    expect(body.electoral.status).toBe("not_configured");
    expect(body.environmental.status).toBe("not_configured");
    expect(body.registry.status).toBe("not_configured");
  });

  it("smoke: extensão mínima por área (16 áreas de extensão)", async () => {
    const claim = await call(
      app,
      "POST",
      `${matter()}/civil/claim-items`,
      { title: "Pedido principal", claimKind: "indemnity", amountCents: 10_000 },
      s.ownerA,
    );
    expect(claim.statusCode).toBe(201);

    const consumer = await call(
      app,
      "POST",
      `${matter()}/consumer-cases`,
      { clientId, supplierName: "Loja X" },
      s.ownerA,
    );
    expect(consumer.statusCode).toBe(201);

    const family = await call(
      app,
      "POST",
      `${matter()}/family/relationships`,
      {
        relationshipType: "spouses",
        partyALabel: "A",
        partyBLabel: "B",
      },
      s.ownerA,
    );
    expect(family.statusCode).toBe(201);

    const estate = await call(
      app,
      "POST",
      `${matter()}/estate-cases`,
      { clientId, deceasedName: "De cujus" },
      s.ownerA,
    );
    expect(estate.statusCode).toBe(201);
    const estateCaseId = estate.json<{ estateCase: { id: string } }>().estateCase.id;
    const asset = await call(
      app,
      "POST",
      `${root()}/estate-cases/${estateCaseId}/assets`,
      { description: "Conta bancária" },
      s.ownerA,
    );
    expect(asset.statusCode).toBe(201);

    const corporate = await call(
      app,
      "POST",
      `${matter()}/corporate-cases`,
      { clientId, companyName: "Acme Ltda" },
      s.ownerA,
    );
    expect(corporate.statusCode).toBe(201);

    const criminal = await call(
      app,
      "POST",
      `${matter()}/criminal-cases`,
      { clientId, phase: "investigation" },
      s.ownerA,
    );
    expect(criminal.statusCode).toBe(201);
    const criminalCaseId = criminal.json<{ criminalCase: { id: string } }>().criminalCase.id;
    const charge = await call(
      app,
      "POST",
      `${root()}/criminal-cases/${criminalCaseId}/charges`,
      { chargeLabel: "Art. 121 CP" },
      s.ownerA,
    );
    expect(charge.statusCode).toBe(201);

    const admin = await call(
      app,
      "POST",
      `${matter()}/administrative-law-cases`,
      { caseKind: "sanction" },
      s.ownerA,
    );
    expect(admin.statusCode).toBe(201);

    const medical = await call(
      app,
      "POST",
      `${matter()}/medical-cases`,
      { clientId, caseKind: "health_plan_denial" },
      s.ownerA,
    );
    expect(medical.statusCode).toBe(201);

    const reAsset = await call(
      app,
      "POST",
      `${matter()}/real-estate-assets`,
      { addressSummary: "Rua A, 1" },
      s.ownerA,
    );
    expect(reAsset.statusCode).toBe(201);

    const environmental = await call(
      app,
      "POST",
      `${matter()}/environmental-cases`,
      { caseKind: "licensing" },
      s.ownerA,
    );
    expect(environmental.statusCode).toBe(201);

    const electoral = await call(
      app,
      "POST",
      `${matter()}/electoral-cases`,
      { caseKind: "registration", electionYear: 2024 },
      s.ownerA,
    );
    expect(electoral.statusCode).toBe(201);

    const sports = await call(
      app,
      "POST",
      `${matter()}/sports-cases`,
      { athleteName: "Atleta", caseKind: "disciplinary" },
      s.ownerA,
    );
    expect(sports.statusCode).toBe(201);

    const digital = await call(
      app,
      "POST",
      `${matter()}/digital-cases`,
      { caseKind: "lgpd" },
      s.ownerA,
    );
    expect(digital.statusCode).toBe(201);

    const international = await call(
      app,
      "POST",
      `${matter()}/international-cases`,
      { country: "PT", caseKind: "recognition" },
      s.ownerA,
    );
    expect(international.statusCode).toBe(201);

    const arbitration = await call(
      app,
      "POST",
      `${matter()}/arbitration-cases`,
      { institution: "CAM-CCBC", status: "draft" },
      s.ownerA,
    );
    expect(arbitration.statusCode).toBe(201);

    const mediation = await call(
      app,
      "POST",
      `${matter()}/mediation-cases`,
      { mediatorName: "Mediador", status: "draft" },
      s.ownerA,
    );
    expect(mediation.statusCode).toBe(201);

    const summary = await call(app, "GET", `${matter()}/area-extensions`, undefined, s.ownerA);
    expect(summary.statusCode).toBe(200);
    const ext = summary.json<{
      extensions: {
        civil: { claimItems: number };
        consumerCases: number;
        family: { relationships: number };
        estateCases: number;
        corporateCases: number;
        criminalCases: number;
        medicalCases: number;
        realEstate: { assets: number };
        environmentalCases: number;
        electoralCases: number;
        sportsCases: number;
        digitalCases: number;
        internationalCases: number;
        arbitrationCases: number;
        mediationCases: number;
      };
    }>().extensions;
    expect(ext.civil.claimItems).toBeGreaterThanOrEqual(1);
    expect(ext.consumerCases).toBeGreaterThanOrEqual(1);
    expect(ext.family.relationships).toBeGreaterThanOrEqual(1);
    expect(ext.estateCases).toBeGreaterThanOrEqual(1);
    expect(ext.corporateCases).toBeGreaterThanOrEqual(1);
    expect(ext.criminalCases).toBeGreaterThanOrEqual(1);
    expect(ext.medicalCases).toBeGreaterThanOrEqual(1);
    expect(ext.realEstate.assets).toBeGreaterThanOrEqual(1);
    expect(ext.environmentalCases).toBeGreaterThanOrEqual(1);
    expect(ext.electoralCases).toBeGreaterThanOrEqual(1);
    expect(ext.sportsCases).toBeGreaterThanOrEqual(1);
    expect(ext.digitalCases).toBeGreaterThanOrEqual(1);
    expect(ext.internationalCases).toBeGreaterThanOrEqual(1);
    expect(ext.arbitrationCases).toBeGreaterThanOrEqual(1);
    expect(ext.mediationCases).toBeGreaterThanOrEqual(1);
  });

  it("auditoria em leitura criminal e medical", async () => {
    const criminalList = await call(app, "GET", `${matter()}/criminal-cases`, undefined, s.ownerA);
    expect(criminalList.statusCode).toBe(200);

    const medicalList = await call(app, "GET", `${matter()}/medical-cases`, undefined, s.ownerA);
    expect(medicalList.statusCode).toBe(200);

    const audits = await database.db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.organizationId, s.orgA),
          like(auditEvents.action, "legal_area.%_record.read"),
        ),
      );
    expect(audits.some((a) => a.action === "legal_area.criminal_record.read")).toBe(true);
    expect(audits.some((a) => a.action === "legal_area.medical_record.read")).toBe(true);
  });

  it("cross-tenant → 404", async () => {
    const cross = await call(app, "GET", `${root(s.orgB)}/legal-area-modules`, undefined, s.ownerB);
    expect(cross.statusCode).toBe(200);

    const matterCross = await call(
      app,
      "GET",
      `${root(s.orgB)}/legal-matters/${s.matterAId}/area-extensions`,
      undefined,
      s.ownerB,
    );
    expect(matterCross.statusCode).toBe(404);

    const outsider = await call(app, "GET", `${matter()}/area-extensions`, undefined, s.outsider);
    expect(outsider.statusCode).toBe(404);
  });
});
