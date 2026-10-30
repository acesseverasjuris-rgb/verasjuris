import { organizations, seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 23 — Control legal/compliance/vendor/product", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let owner: string;
  let orgId: string;

  const root = () => `/v1/organizations/${orgId}/control`;

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
    owner = await registerVerified(app, email, {
      displayName: "Owner LCVP",
      email: "owner.lcvp@exemplo.com",
    });
    const created = await call(app, "POST", "/v1/organizations", { name: "Org LCVP" }, owner);
    orgId = created.json<{ organization: { id: string } }>().organization.id;
    await database.db
      .update(organizations)
      .set({ internalCompany: true })
      .where(eq(organizations.id, orgId));
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("legal IP + DD + policy", async () => {
    const ip = await call(
      app,
      "POST",
      `${root()}/legal/ip`,
      { type: "trademark", title: "Marca VerasJuris" },
      owner,
    );
    expect(ip.statusCode).toBe(201);

    const dd = await call(
      app,
      "POST",
      `${root()}/legal/due-diligence`,
      {
        subjectType: "vendor",
        subjectId: "22222222-2222-4222-8222-222222222222",
        type: "vendor",
      },
      owner,
    );
    expect(dd.statusCode).toBe(201);
    expect(dd.json<{ items: unknown[] }>().items.length).toBeGreaterThan(0);

    const policy = await call(
      app,
      "POST",
      `${root()}/legal/policies`,
      { title: "LGPD", category: "privacy", version: "1" },
      owner,
    );
    expect(policy.statusCode).toBe(201);
  });

  it("compliance risk score + obligation deadline", async () => {
    const risk = await call(
      app,
      "POST",
      `${root()}/compliance/risks`,
      {
        category: "privacy",
        title: "Vazamento",
        likelihood: 3,
        impact: 4,
      },
      owner,
    );
    expect(risk.statusCode).toBe(201);
    expect(risk.json<{ risk: { inherentRisk: number } }>().risk.inherentRisk).toBe(12);

    const obligation = await call(
      app,
      "POST",
      `${root()}/compliance/obligations`,
      {
        title: "Relatório ANPD",
        dueAt: "2026-12-01T00:00:00.000Z",
      },
      owner,
    );
    expect(obligation.statusCode).toBe(201);
    expect(obligation.json<{ deadlineId: string | null }>().deadlineId).toBeTruthy();
  });

  it("vendor SLA + product release without faking deploy", async () => {
    const vendor = await call(
      app,
      "POST",
      `${root()}/vendors`,
      { legalName: "Fornecedor X", status: "active" },
      owner,
    );
    expect(vendor.statusCode).toBe(201);
    const vendorId = vendor.json<{ vendor: { id: string } }>().vendor.id;

    const sla = await call(
      app,
      "POST",
      `${root()}/vendors/slas`,
      { vendorId, metric: "uptime", target: "99.9" },
      owner,
    );
    expect(sla.statusCode).toBe(201);

    const release = await call(
      app,
      "POST",
      `${root()}/product/releases`,
      { version: "1.0.0", name: "Primeiro" },
      owner,
    );
    expect(release.statusCode).toBe(201);
    const releaseId = release.json<{ release: { id: string } }>().release.id;

    const marked = await call(
      app,
      "POST",
      `${root()}/product/releases/${releaseId}/mark-released`,
      { notes: "Release manual com evidência", commitReference: "abc123" },
      owner,
    );
    expect(marked.statusCode).toBe(200);
    const body = marked.json<{
      release: { status: string; deploymentReference: string | null };
      deploymentProvider: { status: string };
    }>();
    expect(body.release.status).toBe("released");
    expect(body.release.deploymentReference).toBeNull();
    expect(body.deploymentProvider.status).toBe("not_configured");
  });
});
