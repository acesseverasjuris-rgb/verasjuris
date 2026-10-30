import { seedReferenceData } from "@verasjuris/database";
import { createTestDatabase } from "@verasjuris/database/testing";
import { MemoryEmailProvider } from "@verasjuris/email";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { call, registerVerified } from "./test-helpers.js";

describe("Etapa 24 — Analytics", () => {
  const started = createTestDatabase();
  const email = new MemoryEmailProvider();
  let app: FastifyInstance;
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let owner: string;
  let outsider: string;
  let orgId: string;
  let otherOrg: string;

  const analytics = (org?: string) => `/v1/organizations/${org ?? orgId}/analytics`;

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
      displayName: "Owner Analytics",
      email: "owner.analytics@exemplo.com",
    });
    outsider = await registerVerified(app, email, {
      displayName: "Outsider Analytics",
      email: "outsider.analytics@exemplo.com",
    });
    const created = await call(app, "POST", "/v1/organizations", { name: "Org Analytics" }, owner);
    orgId = created.json<{ organization: { id: string } }>().organization.id;
    const other = await call(
      app,
      "POST",
      "/v1/organizations",
      { name: "Org Analytics Other" },
      outsider,
    );
    otherOrg = other.json<{ organization: { id: string } }>().organization.id;
  });

  afterAll(async () => {
    await app.close();
    await database.close();
  });

  it("lista métricas e consulta mrr/arr/cac com formulaVersion", async () => {
    const list = await call(app, "GET", `${analytics()}/metrics`, undefined, owner);
    expect(list.statusCode).toBe(200);
    const metrics = list.json<{ metrics: Array<{ key: string; formulaVersion: string }> }>()
      .metrics;
    expect(metrics.some((m) => m.key === "mrr" && m.formulaVersion === "mrr.v1")).toBe(true);
    expect(metrics.some((m) => m.key === "arr" && m.formulaVersion === "arr.v1")).toBe(true);

    const query = await call(
      app,
      "POST",
      `${analytics()}/query`,
      {
        metricKeys: ["mrr", "arr", "cac", "ltv"],
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-12-31T23:59:59.000Z",
      },
      owner,
    );
    expect(query.statusCode).toBe(200);
    const results = query.json<{
      results: Array<{ metricKey: string; status: string; formulaVersion: string }>;
    }>().results;
    const mrr = results.find((r) => r.metricKey === "mrr");
    const arr = results.find((r) => r.metricKey === "arr");
    const cac = results.find((r) => r.metricKey === "cac");
    expect(mrr?.status).toBe("ok");
    expect(mrr?.formulaVersion).toBe("mrr.v1");
    expect(arr?.formulaVersion).toBe("arr.v1");
    expect(cac?.status).toBe("INSUFFICIENT_DATA");
  });

  it("dashboard e export csv; xlsx not configured; permissions", async () => {
    const dash = await call(
      app,
      "GET",
      `${analytics()}/dashboard?tab=executive&periodStart=2026-01-01T00:00:00.000Z&periodEnd=2026-12-31T23:59:59.000Z`,
      undefined,
      owner,
    );
    expect(dash.statusCode).toBe(200);
    expect(dash.json<{ providers: { bi: { status: string } } }>().providers.bi.status).toBe(
      "not_configured",
    );

    const exportCsv = await call(
      app,
      "POST",
      `${analytics()}/export`,
      {
        format: "csv",
        metricKeys: ["mrr", "revenue"],
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-12-31T23:59:59.000Z",
      },
      owner,
    );
    expect(exportCsv.statusCode).toBe(201);
    expect(exportCsv.json<{ export: { format: string; csv: string } }>().export.csv).toContain(
      "metricKey",
    );

    const exportXlsx = await call(
      app,
      "POST",
      `${analytics()}/export`,
      {
        format: "xlsx",
        metricKeys: ["mrr"],
        periodStart: "2026-01-01T00:00:00.000Z",
        periodEnd: "2026-12-31T23:59:59.000Z",
      },
      owner,
    );
    expect(exportXlsx.statusCode).toBe(503);

    const cross = await call(app, "GET", `${analytics(otherOrg)}/metrics`, undefined, owner);
    expect(cross.statusCode).toBe(404);
  });
});
