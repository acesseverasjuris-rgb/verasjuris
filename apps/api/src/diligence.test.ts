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
import { bootstrapEtapa6, type Etapa6Setup } from "./etapa6.fixtures.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 18 — Diligências", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;
  let correspondent: string;
  let requestId: string;
  let proposalA: string;
  let proposalB: string;

  const root = () => `/v1/organizations/${s.orgA}`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-diligence-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    });
    s = await bootstrapEtapa6(app, email, "diligence");
    correspondent = await registerVerified(app, email, {
      displayName: "Correspondente",
      email: "correspondente@exemplo.com",
    });
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/members`,
      { email: "correspondente@exemplo.com" },
      s.ownerA,
    );
    await call(
      app,
      "PUT",
      "/v1/profiles/me/lawyer",
      {
        professionalName: "Correspondente",
        oabNumber: "111222",
        oabUf: "SP",
        practiceAreas: "civil",
      },
      correspondent,
    );

    const created = await call(
      app,
      "POST",
      `${root()}/diligence/requests`,
      {
        typeKey: "protocol_filing",
        title: "Protocolo teste",
        description: "Diligência de teste",
      },
      s.ownerA,
    );
    requestId = created.json<{ request: { id: string } }>().request.id;
    await call(app, "POST", `${root()}/diligence/requests/${requestId}/publish`, {}, s.ownerA);

    proposalA = (
      await call(
        app,
        "POST",
        `${root()}/diligence/proposals`,
        { requestId, amountCents: 15000 },
        correspondent,
      )
    ).json<{ proposal: { id: string } }>().proposal.id;

    const correspondentB = await registerVerified(app, email, {
      displayName: "Correspondente B",
      email: "correspondente.b@exemplo.com",
    });
    await call(
      app,
      "POST",
      `/v1/organizations/${s.orgA}/members`,
      { email: "correspondente.b@exemplo.com" },
      s.ownerA,
    );
    await call(
      app,
      "PUT",
      "/v1/profiles/me/lawyer",
      {
        professionalName: "Correspondente B",
        oabNumber: "333444",
        oabUf: "SP",
        practiceAreas: "civil",
      },
      correspondentB,
    );

    proposalB = (
      await call(
        app,
        "POST",
        `${root()}/diligence/proposals`,
        { requestId, amountCents: 14000 },
        correspondentB,
      )
    ).json<{ proposal: { id: string } }>().proposal.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("aceite race-safe — segunda aceitação conflita", async () => {
    const first = await call(
      app,
      "POST",
      `${root()}/diligence/requests/${requestId}/accept-proposal`,
      { proposalId: proposalA },
      s.ownerA,
    );
    expect(first.statusCode).toBe(200);
    const second = await call(
      app,
      "POST",
      `${root()}/diligence/requests/${requestId}/accept-proposal`,
      { proposalId: proposalB },
      s.ownerA,
    );
    expect(second.statusCode).toBe(409);
  });

  it("evidência marca authenticityClaim=unverified", async () => {
    const res = await call(
      app,
      "POST",
      `${root()}/diligence/requests/${requestId}/evidence`,
      { evidenceType: "protocol", description: "Comprovante" },
      correspondent,
    );
    const body = res.json<{ evidence: { authenticityClaim: string } }>();
    expect(body.evidence.authenticityClaim).toBe("unverified");
  });

  it("cross-tenant — outra org não vê solicitação", async () => {
    const res = await call(
      app,
      "GET",
      `/v1/organizations/${s.orgB}/diligence/requests`,
      undefined,
      s.ownerB,
    );
    const body = res.json<{ requests: Array<{ id: string }> }>();
    expect(body.requests.some((r) => r.id === requestId)).toBe(false);
  });
});
