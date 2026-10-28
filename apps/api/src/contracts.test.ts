import { auditEvents, organizationMembers, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call } from "./test-helpers.js";

describe("Etapa 13 — Contratos e Assinatura API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;
  let clientId: string;
  let contractId: string;
  let versionId: string;
  let partyAId: string;
  let partyBId: string;
  let evidenceDocId: string;

  const root = (org = s?.orgA) => `/v1/organizations/${org}`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-contracts-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    });
    s = await bootstrapEtapa6(app, email, "contracts");
    const matter = await call(app, "GET", `${root()}/matters/${s.matterAId}`, undefined, s.ownerA);
    clientId = matter.json<{ matter: { clientId: string } }>().matter.clientId;

    const doc = await call(
      app,
      "POST",
      `${root()}/documents`,
      {
        title: "Evidência assinatura",
        ownerType: "legal_matter",
        ownerId: s.matterAId,
        confidentialityLevel: "normal",
      },
      s.ownerA,
    );
    expect(doc.statusCode).toBe(201);
    evidenceDocId = doc.json<{ document: { id: string } }>().document.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("status do provedor de assinatura: not_configured", async () => {
    const res = await call(app, "GET", `${root()}/signature-providers/status`, undefined, s.ownerA);
    expect(res.statusCode).toBe(200);
    const body = res.json<{ signature: { status: string } }>();
    expect(body.signature.status).toBe("not_configured");
  });

  it("cria contrato, template e versão", async () => {
    const template = await call(
      app,
      "POST",
      `${root()}/contract-templates`,
      { title: "Modelo serviços", contractType: "services" },
      s.ownerA,
    );
    expect(template.statusCode).toBe(201);
    const templateId = template.json<{ template: { id: string } }>().template.id;

    const created = await call(
      app,
      "POST",
      `${root()}/contracts`,
      {
        title: "Contrato de prestação de serviços",
        clientId,
        legalMatterId: s.matterAId,
        contractTemplateId: templateId,
        contractType: "services",
        effectiveDate: "2020-01-01T00:00:00.000Z",
      },
      s.ownerA,
    );
    expect(created.statusCode).toBe(201);
    contractId = created.json<{ contract: { id: string; status: string } }>().contract.id;
    expect(created.json<{ contract: { status: string } }>().contract.status).toBe("draft");

    const version = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/versions`,
      {
        contractId,
        contentSnapshot: "<p>Corpo do contrato</p>",
      },
      s.ownerA,
    );
    expect(version.statusCode).toBe(201);
    versionId = version.json<{ version: { id: string; version: number } }>().version.id;
    expect(version.json<{ version: { version: number } }>().version.version).toBe(1);

    const audits = await database.db.query.auditEvents.findMany({
      where: eq(auditEvents.action, "contract.created"),
    });
    expect(audits.some((a) => a.resourceId === contractId)).toBe(true);
  });

  it("partes, cláusula snapshot e sanitização XSS", async () => {
    const partyA = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/parties`,
      {
        contractId,
        displayName: "Contratante A",
        partyRole: "contractor",
        signingOrder: 1,
      },
      s.ownerA,
    );
    expect(partyA.statusCode).toBe(201);
    partyAId = partyA.json<{ party: { id: string } }>().party.id;

    const partyB = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/parties`,
      {
        contractId,
        displayName: "Contratada B",
        partyRole: "contractee",
        signingOrder: 2,
      },
      s.ownerA,
    );
    partyBId = partyB.json<{ party: { id: string } }>().party.id;

    const clause = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/clauses`,
      {
        contractVersionId: versionId,
        key: "confidencialidade",
        title: "Confidencialidade",
        contentSnapshot: "<script>alert(1)</script><p>Texto ok</p>",
      },
      s.ownerA,
    );
    expect(clause.statusCode).toBe(201);
    const content = clause.json<{ clauseInstance: { contentSnapshot: string } }>().clauseInstance
      .contentSnapshot;
    expect(content).not.toMatch(/<script/i);
    expect(content).toContain("Texto ok");
  });

  it("aprovação", async () => {
    const membership = await database.db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.organizationId, s.orgA),
    });
    const approval = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/approvals`,
      {
        contractId,
        contractVersionId: versionId,
        approverMembershipId: membership!.id,
      },
      s.ownerA,
    );
    expect(approval.statusCode).toBe(201);
    const approvalId = approval.json<{ approval: { id: string } }>().approval.id;
    const approved = await call(
      app,
      "PATCH",
      `${root()}/contracts/${contractId}/approvals/${approvalId}`,
      { status: "approved", decidedAt: new Date().toISOString() },
      s.ownerA,
    );
    expect(approved.statusCode).toBe(200);
  });

  it("solicitação de assinatura NOT_CONFIGURED não marca assinado", async () => {
    const req = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/signature-requests`,
      {
        contractId,
        contractVersionId: versionId,
      },
      s.ownerA,
    );
    expect(req.statusCode).toBe(201);
    const sigId = req.json<{ signatureRequest: { id: string; status: string } }>().signatureRequest
      .id;
    expect(req.json<{ signatureRequest: { status: string } }>().signatureRequest.status).toBe(
      "not_configured",
    );

    const sent = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/signature-requests/${sigId}/send`,
      {},
      s.ownerA,
    );
    expect(sent.statusCode).toBe(200);
    expect(sent.json<{ signed: boolean; signatureRequest: { status: string } }>().signed).toBe(
      false,
    );
    expect(sent.json<{ signatureRequest: { status: string } }>().signatureRequest.status).toBe(
      "not_configured",
    );

    const contract = await call(
      app,
      "GET",
      `${root()}/contracts/${contractId}`,
      undefined,
      s.ownerA,
    );
    expect(contract.json<{ contract: { status: string } }>().contract.status).not.toBe("signed");
  });

  it("rejeita status signed falso via PATCH", async () => {
    const forbidden = await call(
      app,
      "PATCH",
      `${root()}/contracts/${contractId}`,
      { status: "signed" },
      s.ownerA,
    );
    expect(forbidden.statusCode).toBe(400);
  });

  it("assinatura manual parcial e conclusão com ativação", async () => {
    const partial = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/manual-signatures`,
      {
        contractId,
        contractVersionId: versionId,
        contractPartyId: partyAId,
        signedAt: new Date().toISOString(),
        evidenceDocumentId: evidenceDocId,
        method: "manual",
      },
      s.ownerA,
    );
    expect(partial.statusCode).toBe(201);
    expect(
      partial.json<{ electronicProviderSignature: boolean }>().electronicProviderSignature,
    ).toBe(false);

    const mid = await call(app, "GET", `${root()}/contracts/${contractId}`, undefined, s.ownerA);
    expect(mid.json<{ contract: { status: string } }>().contract.status).toBe("partially_signed");

    const full = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/manual-signatures`,
      {
        contractId,
        contractVersionId: versionId,
        contractPartyId: partyBId,
        signedAt: new Date().toISOString(),
        evidenceDocumentId: evidenceDocId,
        method: "wet_ink",
      },
      s.ownerA,
    );
    expect(full.statusCode).toBe(201);

    const done = await call(app, "GET", `${root()}/contracts/${contractId}`, undefined, s.ownerA);
    expect(done.json<{ contract: { status: string } }>().contract.status).toBe("active");

    const versions = await call(
      app,
      "GET",
      `${root()}/contracts/${contractId}/versions`,
      undefined,
      s.ownerA,
    );
    const v = versions.json<{ items: { id: string; immutable: boolean; status: string }[] }>()
      .items[0];
    expect(v?.immutable).toBe(true);
    expect(v?.status).toBe("signed");

    const blockedClause = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/clauses`,
      {
        contractVersionId: versionId,
        key: "extra",
        title: "Extra",
        contentSnapshot: "Não permitido",
      },
      s.ownerA,
    );
    expect(blockedClause.statusCode).toBe(409);
  });

  it("renovação, expiração, obrigação, aditivo e timeline", async () => {
    const renewal = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/renewals`,
      {
        contractId,
        proposedNewExpiration: "2030-12-31T00:00:00.000Z",
      },
      s.ownerA,
    );
    expect(renewal.statusCode).toBe(201);
    const renewalId = renewal.json<{ renewal: { id: string } }>().renewal.id;
    const completed = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/renewals/${renewalId}/complete`,
      {},
      s.ownerA,
    );
    expect(completed.statusCode).toBe(200);

    const obligation = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/obligations`,
      {
        contractId,
        description: "Entregar relatório mensal",
        dueDate: "2026-06-01T00:00:00.000Z",
      },
      s.ownerA,
    );
    expect(obligation.statusCode).toBe(201);

    const amendment = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/amendments`,
      {
        parentContractId: contractId,
        amendmentType: "prazo",
        notes: "Prorrogação",
      },
      s.ownerA,
    );
    expect(amendment.statusCode).toBe(201);

    const timeline = await call(
      app,
      "GET",
      `${root()}/contracts/${contractId}/timeline`,
      undefined,
      s.ownerA,
    );
    expect(timeline.statusCode).toBe(200);
    expect(timeline.json<{ items: unknown[] }>().items.length).toBeGreaterThan(3);
  });

  it("cross-tenant retorna 404", async () => {
    const foreign = await call(
      app,
      "GET",
      `${root(s.orgB)}/contracts/${contractId}`,
      undefined,
      s.ownerB,
    );
    expect(foreign.statusCode).toBe(404);
  });

  it("biblioteca de cláusulas e política de aprovação", async () => {
    const lib = await call(
      app,
      "POST",
      `${root()}/contract-clauses`,
      {
        key: "lgpd",
        title: "LGPD",
        content: "Tratamento de dados conforme lei.",
      },
      s.ownerA,
    );
    expect(lib.statusCode).toBe(201);

    const policy = await call(
      app,
      "POST",
      `${root()}/contract-approval-policies`,
      { name: "Contratos acima de 100k", minValueCents: 10_000_000 },
      s.ownerA,
    );
    expect(policy.statusCode).toBe(201);
  });

  it("rescisão efetiva", async () => {
    const term = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/terminations`,
      {
        contractId,
        requestedAt: new Date().toISOString(),
        terminationType: "mutual",
      },
      s.ownerA,
    );
    expect(term.statusCode).toBe(201);
    const terminationId = term.json<{ termination: { id: string } }>().termination.id;
    const effective = await call(
      app,
      "POST",
      `${root()}/contracts/${contractId}/terminations/${terminationId}/effective`,
      {},
      s.ownerA,
    );
    expect(effective.statusCode).toBe(200);
    const updated = await call(
      app,
      "GET",
      `${root()}/contracts/${contractId}`,
      undefined,
      s.ownerA,
    );
    expect(updated.json<{ contract: { status: string } }>().contract.status).toBe("terminated");
  });
});
