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
import { call } from "./test-helpers.js";

describe("Etapa 19 — Extrajudicial", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let storageRoot: string;
  let s: Etapa6Setup;

  const root = () => `/v1/organizations/${s.orgA}`;

  beforeAll(async () => {
    database = await started;
    await seedReferenceData(database.db);
    storageRoot = await mkdtemp(path.join(tmpdir(), "vj-extra-"));
    app = await buildApp({
      db: database.db,
      logger: false,
      webOrigin: "http://127.0.0.1:3000",
      isProduction: false,
      email,
      storage: new LocalPrivateStorageProvider(storageRoot),
      malwareScanner: createMalwareScanner(),
    });
    s = await bootstrapEtapa6(app, email, "extrajudicial");
  });

  afterAll(async () => {
    await app.close();
    await database.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it("cartório manual permanece unverified", async () => {
    const res = await call(
      app,
      "POST",
      `${root()}/extrajudicial/registry-offices`,
      { name: "1º RTD Teste", state: "SP", city: "São Paulo" },
      s.ownerA,
    );
    const body = res.json<{ office: { verificationStatus: string; source: string } }>();
    expect(body.office.source).toBe("manual");
    expect(body.office.verificationStatus).toBe("unverified");
  });

  it("orçamento manual_estimate com disclaimer", async () => {
    const req = await call(
      app,
      "POST",
      `${root()}/extrajudicial/requests`,
      {
        serviceTypeKey: "certidao",
        description: "Certidão para teste",
      },
      s.ownerA,
    );
    expect(req.statusCode).toBe(201);
    const requestId = req.json<{ request: { id: string } }>().request.id;
    const quote = await call(
      app,
      "POST",
      `${root()}/extrajudicial/requests/${requestId}/quotes`,
      {
        totalEstimateCents: 25000,
        source: "manual_estimate",
      },
      s.ownerA,
    );
    expect(quote.statusCode).toBe(201);
    expect(
      quote.json<{ quote: { officialFeesDisclaimer?: string } }>().quote.officialFeesDisclaimer,
    ).toContain("estimativa manual");
  });

  it("fee_table NOT_CONFIGURED", async () => {
    const req = await call(
      app,
      "POST",
      `${root()}/extrajudicial/requests`,
      { serviceTypeKey: "certidao", description: "Teste fee table" },
      s.ownerA,
    );
    const requestId = req.json<{ request: { id: string } }>().request.id;
    const quote = await call(
      app,
      "POST",
      `${root()}/extrajudicial/requests/${requestId}/quotes`,
      {
        totalEstimateCents: 10000,
        source: "fee_table",
      },
      s.ownerA,
    );
    expect(quote.statusCode).toBe(503);
  });

  it("protocolo automático bloqueado sem RegistryProvider", async () => {
    const req = await call(
      app,
      "POST",
      `${root()}/extrajudicial/requests`,
      { serviceTypeKey: "registro", description: "Pedido protocolo" },
      s.ownerA,
    );
    expect(req.statusCode).toBe(201);
    const requestId = req.json<{ request: { id: string } }>().request.id;
    const quote = await call(
      app,
      "POST",
      `${root()}/extrajudicial/requests/${requestId}/quotes`,
      {
        totalEstimateCents: 50000,
        source: "manual_estimate",
      },
      s.ownerA,
    );
    const quoteId = quote.json<{ quote: { id: string } }>().quote.id;
    const order = await call(
      app,
      "POST",
      `${root()}/extrajudicial/requests/${requestId}/quotes/${quoteId}/accept`,
      {},
      s.ownerA,
    );
    const orderId = order.json<{ order: { id: string } }>().order.id;
    const submit = await call(
      app,
      "POST",
      `${root()}/extrajudicial/orders/${orderId}/submit-provider`,
      {},
      s.ownerA,
    );
    expect(submit.statusCode).toBe(503);
  });
});
