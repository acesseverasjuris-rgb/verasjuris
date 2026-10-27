import { describe, expect, it } from "vitest";
import { buildWorkerApp } from "./app.js";

describe("worker", () => {
  it("informa o processo saudável e a fila não configurada", async () => {
    const app = await buildWorkerApp({
      logger: false,
      checkDatabase: async () => "ok",
    });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    const body = response.json<{ status: string; checks: { database: string; queue: string } }>();
    expect(body.status).toBe("ok");
    expect(body.checks.database).toBe("ok");
    expect(body.checks.queue).toBe("not_configured");
    expect(JSON.stringify(body)).not.toMatch(/postgres:\/\//);
    await app.close();
  });

  it("responde indisponível quando o banco falha", async () => {
    const app = await buildWorkerApp({
      logger: false,
      checkDatabase: async () => "unavailable",
    });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(503);
    expect(response.json<{ checks: { database: string } }>().checks.database).toBe("unavailable");
    await app.close();
  });
});
