import { describe, expect, it } from "vitest";
import { createProviderRegistry } from "./provider-registry.js";

describe("ProviderRegistry", () => {
  it("lista sem invocar health e executa healthCheck sob demanda", async () => {
    let calls = 0;
    const registry = createProviderRegistry([
      {
        key: "demo",
        type: "test",
        status: "not_configured",
        capabilities: ["ping"],
        healthCheck: async () => {
          calls += 1;
          return { status: "not_configured", checkedAt: new Date().toISOString() };
        },
      },
    ]);
    expect(registry.list()).toHaveLength(1);
    expect(calls).toBe(0);
    const health = await registry.healthCheckAll();
    expect(calls).toBe(1);
    expect(health[0]?.health.status).toBe("not_configured");
  });
});
