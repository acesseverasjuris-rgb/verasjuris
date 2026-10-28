import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { createMalwareScanner, LocalPrivateStorageProvider } from "@verasjuris/storage";
import type { FastifyInstance } from "fastify";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { bootstrapEtapa6, createDocumentWithFile, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call, registerVerified } from "./test-helpers.js";

async function upsertLawyerMarketplace(
  app: FastifyInstance,
  cookie: string,
  orgId: string,
  opts?: { oabUf?: string },
) {
  await call(
    app,
    "PUT",
    "/v1/profiles/me/lawyer",
    {
      professionalName: "Dr. Marketplace",
      oabNumber: "654321",
      oabUf: opts?.oabUf ?? "SP",
      practiceAreas: "civil trabalhista",
    },
    cookie,
  );
  await call(
    app,
    "PATCH",
    `/v1/organizations/${orgId}/marketplace/profile`,
    {
      marketplaceEnabled: true,
      marketplaceStatus: "active",
      marketplaceHeadline: "Advogado experiente",
      remoteAvailable: true,
      serviceStates: "SP",
    },
    cookie,
  );
}

describe("Etapa 17 — Marketplace jurídico API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;
  let lawyerB: string;
  let categoryId: string;
  let requestId: string;
  let proposalId: string;
  let engagementId: string;
  let deliveryId: string;
  let disputeId: string;
  let evidenceDocId: string;
  let clientId: string;

  const root = (org = s?.orgA) => `/v1/organizations/${org}`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-marketplace-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    });
    s = await bootstrapEtapa6(app, email, "marketplace");

    lawyerB = await registerVerified(app, email, {
      displayName: "Lawyer Marketplace B",
      email: "lawyer.b.marketplace@exemplo.com",
    });
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/members`,
      { email: "lawyer.b.marketplace@exemplo.com" },
      s.ownerA,
    );

    await upsertLawyerMarketplace(app, lawyerB, s.orgA);
    await upsertLawyerMarketplace(app, s.ownerA, s.orgA);

    const matter = await call(app, "GET", `${root()}/matters/${s.matterAId}`, undefined, s.ownerA);
    clientId = matter.json<{ matter: { clientId: string } }>().matter.clientId;

    const cats = await call(app, "GET", `${root()}/marketplace/categories`, undefined, s.memberA);
    categoryId = cats.json<{ items: Array<{ id: string }> }>().items[0]!.id;

    const doc = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
      title: "Comprovante pagamento",
      fileName: "comprovante.txt",
      content: Buffer.from("pago", "utf8"),
      mime: "text/plain",
      confidentialityLevel: "confidential",
    });
    evidenceDocId = doc.documentId;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("payment provider status NOT_CONFIGURED", async () => {
    const res = await call(
      app,
      "GET",
      `${root()}/marketplace/providers/status`,
      undefined,
      s.memberA,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json<{ payment: { status: string } }>().payment.status).toBe("not_configured");
  });

  it("fluxo request → proposal → accept → delivery → complete → review", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/marketplace/requests`,
      {
        clientId,
        categoryId,
        title: "Revisão de contrato de prestação de serviços",
        description:
          "Preciso de revisão completa de contrato com cláusulas de confidencialidade e SLA detalhado.",
        urgency: "normal",
        locationState: "SP",
        remoteAllowed: true,
        status: "draft",
      },
      s.memberA,
    );
    expect(created.statusCode).toBe(201);
    requestId = created.json<{ request: { id: string } }>().request.id;

    const published = await call(
      app,
      "POST",
      `${root()}/marketplace/requests/${requestId}/publish`,
      {},
      s.memberA,
    );
    expect(published.statusCode).toBe(200);

    const proposal = await call(
      app,
      "POST",
      `${root()}/marketplace/requests/${requestId}/proposals`,
      {
        amountCents: 150_000,
        message: "Posso entregar em 5 dias úteis com duas rodadas de revisão incluídas.",
      },
      lawyerB,
    );
    expect(proposal.statusCode).toBe(201);
    proposalId = proposal.json<{ proposal: { id: string } }>().proposal.id;

    const accepted = await call(
      app,
      "POST",
      `${root()}/marketplace/proposals/${proposalId}/accept`,
      { revisionLimit: 2 },
      s.memberA,
    );
    expect(accepted.statusCode).toBe(200);
    engagementId = accepted.json<{ engagement: { id: string } }>().engagement.id;

    const delivery = await call(
      app,
      "POST",
      `${root()}/marketplace/engagements/${engagementId}/deliveries`,
      {
        description: "Entrega da minuta revisada conforme combinado.",
      },
      lawyerB,
    );
    expect(delivery.statusCode).toBe(201);
    deliveryId = delivery.json<{ delivery: { id: string } }>().delivery.id;

    const reviewed = await call(
      app,
      "POST",
      `${root()}/marketplace/engagements/${engagementId}/deliveries/${deliveryId}/review`,
      { action: "accept" },
      s.memberA,
    );
    expect(reviewed.statusCode).toBe(200);

    const completed = await call(
      app,
      "POST",
      `${root()}/marketplace/engagements/${engagementId}/complete`,
      {},
      s.memberA,
    );
    expect(completed.statusCode).toBe(200);

    const review = await call(
      app,
      "POST",
      `${root()}/marketplace/engagements/${engagementId}/reviews`,
      { rating: 5, comment: "Excelente trabalho, entrega clara e no prazo." },
      s.memberA,
    );
    expect(review.statusCode).toBe(201);
  });

  it("bloqueia auto-proposta", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/marketplace/requests`,
      {
        categoryId,
        title: "Consultoria rápida sobre compliance",
        description: "Preciso orientação sobre LGPD em contratos com fornecedores internacionais.",
        locationState: "SP",
        status: "open",
      },
      s.memberA,
    );
    const rid = created.json<{ request: { id: string } }>().request.id;
    const self = await call(
      app,
      "POST",
      `${root()}/marketplace/requests/${rid}/proposals`,
      { amountCents: 50_000, message: "Proposta inválida do próprio solicitante." },
      s.memberA,
    );
    expect(self.statusCode).toBe(409);
  });

  it("cross-tenant retorna 404", async () => {
    const res = await call(
      app,
      "GET",
      `${root(s.orgB)}/marketplace/requests/${requestId}`,
      undefined,
      s.ownerB,
    );
    expect(res.statusCode).toBe(404);
  });

  it("pagamento via provider NOT_CONFIGURED", async () => {
    const res = await call(
      app,
      "POST",
      `${root()}/marketplace/engagements/${engagementId}/payment/provider`,
      {},
      s.memberA,
    );
    expect(res.statusCode).toBe(503);
    expect(res.json<{ error: { code: string } }>().error.code).toBe(
      "PAYMENT_PROVIDER_NOT_CONFIGURED",
    );
  });

  it("disputa impede conclusão", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/marketplace/requests`,
      {
        clientId,
        categoryId,
        title: "Petição inicial trabalhista",
        description: "Elaboração de petição inicial com pedidos de horas extras e reflexos.",
        locationState: "SP",
        status: "open",
      },
      s.memberA,
    );
    const rid = created.json<{ request: { id: string } }>().request.id;
    const prop = await call(
      app,
      "POST",
      `${root()}/marketplace/requests/${rid}/proposals`,
      { amountCents: 80_000, message: "Entrega em 7 dias." },
      lawyerB,
    );
    const pid = prop.json<{ proposal: { id: string } }>().proposal.id;
    const eng = await call(
      app,
      "POST",
      `${root()}/marketplace/proposals/${pid}/accept`,
      {},
      s.memberA,
    );
    const eid = eng.json<{ engagement: { id: string } }>().engagement.id;
    const del = await call(
      app,
      "POST",
      `${root()}/marketplace/engagements/${eid}/deliveries`,
      { description: "Entrega parcial para teste de disputa." },
      lawyerB,
    );
    const did = del.json<{ delivery: { id: string } }>().delivery.id;
    await call(
      app,
      "POST",
      `${root()}/marketplace/engagements/${eid}/deliveries/${did}/review`,
      { action: "accept" },
      s.memberA,
    );
    const dispute = await call(
      app,
      "POST",
      `${root()}/marketplace/engagements/${eid}/disputes`,
      {
        reasonCode: "quality",
        description: "A entrega não atendeu o escopo acordado na proposta.",
      },
      s.memberA,
    );
    expect(dispute.statusCode).toBe(201);
    disputeId = dispute.json<{ dispute: { id: string } }>().dispute.id;
    const blocked = await call(
      app,
      "POST",
      `${root()}/marketplace/engagements/${eid}/complete`,
      {},
      s.memberA,
    );
    expect(blocked.statusCode).toBe(409);
  });

  it("aceite concorrente de propostas — apenas uma contratação", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/marketplace/requests`,
      {
        categoryId,
        title: "Due diligence societária",
        description: "Análise documental de target para aquisição minoritária em startup.",
        locationState: "SP",
        status: "open",
      },
      s.memberA,
    );
    const rid = created.json<{ request: { id: string } }>().request.id;
    const p1 = await call(
      app,
      "POST",
      `${root()}/marketplace/requests/${rid}/proposals`,
      { amountCents: 200_000, message: "Proposta A" },
      lawyerB,
    );
    const pid = p1.json<{ proposal: { id: string } }>().proposal.id;

    const lawyerC = await registerVerified(app, email, {
      displayName: "Lawyer C MP",
      email: "lawyer.c.marketplace@exemplo.com",
    });
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/members`,
      { email: "lawyer.c.marketplace@exemplo.com" },
      s.ownerA,
    );
    await upsertLawyerMarketplace(app, lawyerC, s.orgA);

    const p2Attempt = await call(
      app,
      "POST",
      `${root()}/marketplace/requests/${rid}/proposals`,
      { amountCents: 180_000, message: "Proposta B de outro advogado" },
      lawyerC,
    );
    expect(p2Attempt.statusCode).toBe(201);

    const accept1 = await call(
      app,
      "POST",
      `${root()}/marketplace/proposals/${pid}/accept`,
      {},
      s.memberA,
    );
    expect(accept1.statusCode).toBe(200);

    const proposals = await call(
      app,
      "GET",
      `${root()}/marketplace/requests/${rid}/proposals`,
      undefined,
      s.memberA,
    );
    const items = proposals.json<{ items: Array<{ status: string }> }>().items;
    const acceptedCount = items.filter((i) => i.status === "accepted").length;
    expect(acceptedCount).toBe(1);
  });

  it("pagamento manual com comprovante", async () => {
    const res = await call(
      app,
      "POST",
      `${root()}/marketplace/engagements/${engagementId}/payment/manual`,
      {
        amountCents: 150_000,
        evidenceDocumentId: evidenceDocId,
        description: "PIX marketplace",
      },
      s.memberA,
    );
    expect(res.statusCode).toBe(200);
    expect(res.json<{ paymentRecordId: string }>().paymentRecordId).toBeTruthy();
  });
});
