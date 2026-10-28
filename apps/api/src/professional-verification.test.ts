import { seedReferenceData } from "@verasjuris/database";
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
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 17.1 — Verificação profissional", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;
  let lawyerCookie: string;
  let oabCaseId: string;
  let cpfCaseId: string;

  const root = () => `/v1/organizations/${s.orgA}`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-prof-ver-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    });
    s = await bootstrapEtapa6(app, email, "prof-ver");
    lawyerCookie = await registerVerified(app, email, {
      displayName: "Adv Verificação",
      email: "adv.verificacao@exemplo.com",
    });
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/members`,
      { email: "adv.verificacao@exemplo.com" },
      s.ownerA,
    );
    await call(
      app,
      "PUT",
      "/v1/profiles/me/lawyer",
      {
        professionalName: "Adv Verificação",
        oabNumber: "999888",
        oabUf: "SP",
        practiceAreas: "civil",
      },
      lawyerCookie,
    );

    const oabCase = await call(
      app,
      "POST",
      `${root()}/professional-verification/cases`,
      { verificationType: "oab" },
      lawyerCookie,
    );
    oabCaseId = oabCase.json<{ case: { id: string } }>().case.id;

    const cpfCase = await call(
      app,
      "POST",
      `${root()}/professional-verification/cases`,
      { verificationType: "cpf" },
      lawyerCookie,
    );
    cpfCaseId = cpfCase.json<{ case: { id: string } }>().case.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("OAB informada ≠ verificada com provedor NOT_CONFIGURED", async () => {
    const res = await call(
      app,
      "POST",
      `${root()}/professional-verification/cases/${oabCaseId}/oab`,
      { oabNumber: "123456", oabUf: "SP" },
      lawyerCookie,
    );
    const body = res.json<{ informedOnly: boolean; case: { status: string } }>();
    expect(body.informedOnly).toBe(true);
    expect(body.case.status).not.toBe("verified");
  });

  it("CPF format válido ≠ identidade verificada", async () => {
    const res = await call(
      app,
      "POST",
      `${root()}/professional-verification/cases/${cpfCaseId}/cpf`,
      { cpf: "390.533.447-05" },
      lawyerCookie,
    );
    const body = res.json<{
      case: { status: string; subjectMetadata: { identityVerified?: boolean } };
    }>();
    expect(body.case.status).toBe("pending");
    expect(body.case.subjectMetadata?.identityVerified).not.toBe(true);
  });

  it("biometria NOT_CONFIGURED não simula aprovação", async () => {
    const created = await call(
      app,
      "POST",
      `${root()}/professional-verification/cases`,
      { verificationType: "biometric" },
      lawyerCookie,
    );
    const caseId = created.json<{ case: { id: string } }>().case.id;
    const consent = await call(
      app,
      "POST",
      `${root()}/professional-verification/cases/${caseId}/biometric/consent`,
      { consentTermVersion: "v1" },
      lawyerCookie,
    );
    const sessionId = consent.json<{ sessionId: string }>().sessionId;
    const start = await call(
      app,
      "POST",
      `${root()}/professional-verification/cases/${caseId}/biometric/sessions/${sessionId}/start`,
      {},
      lawyerCookie,
    );
    expect(start.statusCode).toBe(503);
  });

  it("bloqueia autoaprovação", async () => {
    const review = await call(
      app,
      "POST",
      `${root()}/professional-verification/cases/${oabCaseId}/reviews`,
      { decision: "approved" },
      lawyerCookie,
    );
    expect(review.statusCode).toBe(403);
  });

  it("suspensão registrada com auditoria", async () => {
    const session = await call(app, "GET", "/v1/auth/session", undefined, lawyerCookie);
    const userId = session.json<{ account: { user: { id: string } } }>().account.user.id;
    const res = await call(
      app,
      "POST",
      `${root()}/professional-verification/suspensions`,
      { professionalProfileId: userId, reason: "Documentação pendente", scope: "all" },
      s.ownerA,
    );
    expect(res.statusCode).toBe(201);
  });
});
