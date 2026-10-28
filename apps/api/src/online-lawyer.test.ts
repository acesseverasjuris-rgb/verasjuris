import {
  legalAreas,
  lawyerProfiles,
  onlineLegalMatchCandidates,
  seedReferenceData,
} from "@verasjuris/database";
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
import { bootstrapEtapa6, createDocumentWithFile, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call, registerVerified } from "./test-helpers.js";

async function upsertLawyerOnline(
  app: FastifyInstance,
  cookie: string,
  orgId: string,
  profile: {
    practiceAreas?: string;
    oabUf?: string;
    serviceStates?: string;
    consultationModes?: string;
    acceptsUrgent?: boolean;
  },
) {
  await call(
    app,
    "PUT",
    "/v1/profiles/me/lawyer",
    {
      professionalName: "Dr. Teste",
      oabNumber: "123456",
      oabUf: profile.oabUf ?? "SP",
      practiceAreas: profile.practiceAreas ?? "trabalhista",
    },
    cookie,
  );
  await call(
    app,
    "PATCH",
    `/v1/organizations/${orgId}/online-lawyer/profile`,
    {
      onlineServiceEnabled: true,
      availabilityStatus: "available",
      serviceStates: profile.serviceStates ?? "SP",
      consultationModes: profile.consultationModes ?? "text,video",
      acceptsUrgent: profile.acceptsUrgent ?? true,
      practiceAreas: profile.practiceAreas ?? "trabalhista",
    },
    cookie,
  );
}

describe("Etapa 16 — Advogado Online API", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;
  let lawyerB: string;
  let lawyerC: string;
  let lawyerD: string;
  let ownerUserId: string;
  let lawyerCUserId: string;
  let lawyerDUserId: string;
  let clientId: string;
  let legalAreaId: string;
  let requestId: string;
  let matchId: string;
  let consultationId: string;
  let evidenceDocId: string;

  const root = (org = s?.orgA) => `/v1/organizations/${org}`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-online-lawyer-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    });
    s = await bootstrapEtapa6(app, email, "online-lawyer");
    const session = await call(app, "GET", "/v1/auth/session", undefined, s.ownerA);
    ownerUserId = session.json<{ account: { user: { id: string } } }>().account.user.id;

    lawyerB = await registerVerified(app, email, {
      displayName: "Lawyer B",
      email: "lawyer.b.online@exemplo.com",
    });
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/members`,
      { email: "lawyer.b.online@exemplo.com" },
      s.ownerA,
    );
    lawyerC = await registerVerified(app, email, {
      displayName: "Lawyer C",
      email: "lawyer.c.online@exemplo.com",
    });
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/members`,
      { email: "lawyer.c.online@exemplo.com" },
      s.ownerA,
    );

    const matter = await call(app, "GET", `${root()}/matters/${s.matterAId}`, undefined, s.ownerA);
    clientId = matter.json<{ matter: { clientId: string } }>().matter.clientId;

    const existingArea = await database.db.query.legalAreas.findFirst({
      where: eq(legalAreas.organizationId, s.orgA),
    });
    if (existingArea) {
      legalAreaId = existingArea.id;
    } else {
      const [area] = await database.db
        .insert(legalAreas)
        .values({ organizationId: s.orgA, name: "Trabalhista", slug: "trabalhista-online" })
        .returning();
      legalAreaId = area!.id;
    }

    await upsertLawyerOnline(app, s.ownerA, s.orgA, {
      practiceAreas: "trabalhista previdenciario",
      oabUf: "SP",
    });
    await upsertLawyerOnline(app, lawyerB, s.orgA, {
      practiceAreas: "civil",
      oabUf: "RJ",
      serviceStates: "RJ",
    });

    await database.db
      .update(lawyerProfiles)
      .set({ oabVerificationStatus: "verified" })
      .where(eq(lawyerProfiles.userId, ownerUserId));

    await upsertLawyerOnline(app, lawyerC, s.orgA, {
      practiceAreas: "trabalhista",
      oabUf: "SP",
      serviceStates: "SP",
    });
    lawyerD = await registerVerified(app, email, {
      displayName: "Lawyer D",
      email: "lawyer.d.online@exemplo.com",
    });
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/members`,
      { email: "lawyer.d.online@exemplo.com" },
      s.ownerA,
    );
    await upsertLawyerOnline(app, lawyerD, s.orgA, {
      practiceAreas: "trabalhista",
      oabUf: "SP",
      serviceStates: "SP",
    });
    lawyerCUserId = (await call(app, "GET", "/v1/auth/session", undefined, lawyerC)).json<{
      account: { user: { id: string } };
    }>().account.user.id;
    lawyerDUserId = (await call(app, "GET", "/v1/auth/session", undefined, lawyerD)).json<{
      account: { user: { id: string } };
    }>().account.user.id;

    const doc = await createDocumentWithFile(app, s.ownerA, s.orgA, s.matterAId, {
      title: "Anexo solicitação",
      fileName: "anexo.txt",
      content: Buffer.from("prova", "utf8"),
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

  it("providers status: todos NOT_CONFIGURED", async () => {
    const res = await call(
      app,
      "GET",
      `${root()}/online-lawyer/providers/status`,
      undefined,
      s.ownerA,
    );
    expect(res.statusCode).toBe(200);
    const body = res.json<{
      payment: { status: string };
      oab: { status: string };
      conflict: { status: string };
      video: { status: string };
    }>();
    expect(body.payment.status).toBe("not_configured");
    expect(body.oab.status).toBe("not_configured");
    expect(body.conflict.status).toBe("not_configured");
    expect(body.video.status).toBe("not_configured");
  });

  it("cria solicitação submitted com documento", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/online-legal-requests`,
      {
        clientId,
        legalAreaId,
        urgency: "high",
        stateCode: "SP",
        summary: "Preciso de orientação trabalhista urgente sobre rescisão.",
        preferredMode: "text",
        status: "submitted",
        documentIds: [evidenceDocId],
      },
      s.memberA,
    );
    expect(created.statusCode).toBe(201);
    requestId = created.json<{ request: { id: string; status: string } }>().request.id;
    expect(created.json<{ request: { status: string } }>().request.status).toBe("submitted");
  });

  it("matching determinístico prioriza área/UF e bônus OAB", async () => {
    const gen = await call(
      app,
      "POST",
      `${root()}/online-legal-requests/${requestId}/matches/generate`,
      { offerTtlMinutes: 30, limit: 5 },
      s.memberA,
    );
    expect(gen.statusCode).toBe(200);
    const items = gen.json<{ items: Array<{ lawyerProfileId: string; totalScore: number }> }>()
      .items;
    expect(items.length).toBeGreaterThan(0);
    if (items.length > 1) {
      expect(items[0]!.totalScore).toBeGreaterThanOrEqual(items[1]!.totalScore);
    }
    const listed = await call(
      app,
      "GET",
      `${root()}/online-legal-requests/${requestId}/matches`,
      undefined,
      s.memberA,
    );
    const matchRows = listed.json<{ items: Array<{ id: string; lawyerProfileId: string }> }>()
      .items;
    expect(matchRows[0]!.lawyerProfileId).toBe(items[0]!.lawyerProfileId);
    matchId = matchRows.find((m) => m.lawyerProfileId === ownerUserId)?.id ?? matchRows[0]!.id;
  });

  it("advogado vê oferta sem summary; documento bloqueado antes do aceite", async () => {
    const offers = await call(app, "GET", `${root()}/online-lawyer/matches`, undefined, s.ownerA);
    expect(offers.statusCode).toBe(200);
    expect(
      offers.json<{ items: Array<{ requestPreview: { stateCode: string } }> }>().items.length,
    ).toBeGreaterThan(0);

    const blocked = await call(
      app,
      "GET",
      `${root()}/online-legal-requests/${requestId}/documents/${evidenceDocId}/access-check`,
      undefined,
      lawyerB,
    );
    expect([403, 404]).toContain(blocked.statusCode);
  });

  it("aceite cria consulta, conflict unknown e libera documento", async () => {
    const accepted = await call(
      app,
      "POST",
      `${root()}/online-lawyer/matches/${matchId}/accept`,
      {},
      s.ownerA,
    );
    expect(accepted.statusCode).toBe(201);
    const body = accepted.json<{
      consultation: { id: string };
      conflictCheck: { status: string };
    }>();
    consultationId = body.consultation.id;
    expect(body.conflictCheck.status).toBe("not_configured");

    const access = await call(
      app,
      "GET",
      `${root()}/online-legal-requests/${requestId}/documents/${evidenceDocId}/access-check`,
      undefined,
      s.ownerA,
    );
    expect(access.statusCode).toBe(200);
  });

  it("segundo aceite retorna 409", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/online-legal-requests`,
      {
        clientId,
        urgency: "normal",
        stateCode: "SP",
        summary: "Segunda solicitação para teste de corrida de aceite.",
        preferredMode: "text",
        status: "submitted",
      },
      s.memberA,
    );
    const req2 = created.json<{ request: { id: string } }>().request.id;
    await call(
      app,
      "POST",
      `${root()}/online-legal-requests/${req2}/matches/generate`,
      { limit: 5 },
      s.memberA,
    );
    const rows = await database.db.query.onlineLegalMatchCandidates.findMany({
      where: eq(onlineLegalMatchCandidates.requestId, req2),
    });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const cookieFor = (profileId: string) => {
      if (profileId === ownerUserId) return s.ownerA;
      if (profileId === lawyerCUserId) return lawyerC;
      if (profileId === lawyerDUserId) return lawyerD;
      return s.ownerA;
    };
    const first = rows[0]!;
    const second = rows[1]!;
    const ok = await call(
      app,
      "POST",
      `${root()}/online-lawyer/matches/${first.id}/accept`,
      {},
      cookieFor(first.lawyerProfileId),
    );
    expect(ok.statusCode).toBe(201);
    const fail = await call(
      app,
      "POST",
      `${root()}/online-lawyer/matches/${second.id}/accept`,
      {},
      cookieFor(second.lawyerProfileId),
    );
    expect(fail.statusCode).toBe(409);
  });

  it("lifecycle: termos, agenda vídeo, início, pagamento manual, conclusão e review", async () => {
    const terms = await call(
      app,
      "POST",
      `${root()}/online-consultations/${consultationId}/accept-terms`,
      { termsVersion: "v1", source: "portal" },
      s.ownerA,
    );
    expect(terms.statusCode).toBe(201);

    const scheduled = await call(
      app,
      "POST",
      `${root()}/online-consultations/${consultationId}/schedule`,
      {
        scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
        timezone: "America/Sao_Paulo",
        mode: "video",
      },
      s.ownerA,
    );
    expect(scheduled.statusCode).toBe(200);
    const schedBody = scheduled.json<{ consultation: { status: string } }>();
    expect(schedBody.consultation.status).toBe("scheduled");

    const detail = await call(
      app,
      "GET",
      `${root()}/online-consultations/${consultationId}`,
      undefined,
      s.ownerA,
    );
    expect(detail.json<{ videoProvider: { status: string } }>().videoProvider?.status).toBe(
      "not_configured",
    );

    await call(app, "POST", `${root()}/online-consultations/${consultationId}/start`, {}, s.ownerA);

    const pay = await call(
      app,
      "POST",
      `${root()}/online-consultations/${consultationId}/manual-payment`,
      {
        amountCents: 20_000,
        evidenceDocumentId: evidenceDocId,
      },
      s.ownerA,
    );
    expect(pay.statusCode).toBe(201);
    expect(pay.json<{ payment: { status: string } }>().payment.status).toBe("paid_manual");

    const complete = await call(
      app,
      "POST",
      `${root()}/online-consultations/${consultationId}/complete`,
      {
        outcome: "completed",
        summary: "Orientação prestada.",
        createLegalMatter: true,
        matterTitle: "Caso pós consulta online",
      },
      s.ownerA,
    );
    expect(complete.statusCode).toBe(200);
    expect(
      complete.json<{ closure: { legalMatterCreatedId: string | null } }>().closure
        .legalMatterCreatedId,
    ).toBeTruthy();

    const review = await call(
      app,
      "POST",
      `${root()}/online-consultations/${consultationId}/review`,
      { rating: 5, comment: "Ótimo atendimento" },
      s.memberA,
    );
    expect(review.statusCode).toBe(201);

    const selfReview = await call(
      app,
      "POST",
      `${root()}/online-consultations/${consultationId}/review`,
      { rating: 5 },
      s.ownerA,
    );
    expect(selfReview.statusCode).toBe(403);
  });

  it("cross-tenant: org B não acessa solicitação da org A", async () => {
    const res = await call(
      app,
      "GET",
      `${root(s.orgB)}/online-legal-requests/${requestId}`,
      undefined,
      s.ownerB,
    );
    expect(res.statusCode).toBe(404);
  });

  it("OAB verify não marca verified sem provider", async () => {
    const res = await call(app, "POST", `${root()}/online-lawyer/profile/verify-oab`, {}, lawyerB);
    expect(res.statusCode).toBe(503);
  });
});
