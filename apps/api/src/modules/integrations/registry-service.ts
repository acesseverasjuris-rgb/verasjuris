import type { ProviderRegistry } from "@verasjuris/ai";
import type { AppDatabase } from "@verasjuris/database";
import { integrationHealthChecks } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";

export class IntegrationRegistryService {
  constructor(
    private readonly db: AppDatabase,
    private readonly registry: ProviderRegistry,
  ) {}

  listProviders(type?: string) {
    const items = type ? this.registry.listByType(type) : this.registry.list();
    return { items };
  }

  async healthCheckAll(organizationId?: string) {
    const results = await this.registry.healthCheckAll();
    const now = new Date();
    for (const item of results) {
      const status =
        item.health.status === "ok"
          ? "healthy"
          : item.health.status === "not_configured"
            ? "not_configured"
            : item.health.status === "degraded"
              ? "degraded"
              : "failed";
      await this.db.insert(integrationHealthChecks).values({
        organizationId: organizationId ?? null,
        providerKey: item.key,
        status,
        checkedAt: now,
        detail: { detail: item.health.detail ?? null },
        latencyMs: null,
      });
    }
    return { items: results };
  }

  async healthCheckOne(providerKey: string, organizationId?: string) {
    const provider = this.registry.get(providerKey);
    if (!provider) {
      throw new AppError("NOT_FOUND", "Provedor de integração não encontrado no registry.");
    }
    const health = await provider.healthCheck();
    const status =
      health.status === "ok"
        ? "healthy"
        : health.status === "not_configured"
          ? "not_configured"
          : health.status === "degraded"
            ? "degraded"
            : "failed";
    const [row] = await this.db
      .insert(integrationHealthChecks)
      .values({
        organizationId: organizationId ?? null,
        providerKey,
        status,
        checkedAt: new Date(),
        detail: { detail: health.detail ?? null },
      })
      .returning();
    return { provider: { key: providerKey, health }, check: row };
  }
}
