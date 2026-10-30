/**
 * Registry leve de providers — lista key/type/status/capabilities/healthCheck
 * a partir de instâncias injetadas. Não chama SDKs externos por conta própria.
 */

export type ProviderRegistryStatus =
  | "configured"
  | "not_configured"
  | "degraded"
  | "failed"
  | "disabled";

export type ProviderHealthSnapshot = {
  status: "ok" | "degraded" | "unavailable" | "not_configured" | string;
  detail?: string;
  checkedAt: string;
};

export type RegisteredProvider = {
  key: string;
  type: string;
  status: ProviderRegistryStatus;
  capabilities: readonly string[];
  configurationStatus?: ProviderRegistryStatus;
  lastHealthCheck?: string | null;
  retryPolicy?: { maxAttempts?: number; backoffMs?: number } | null;
  timeoutPolicy?: { timeoutMs?: number } | null;
  /** Referência injetada — chamar só quando o caller quiser health real. */
  healthCheck: () => Promise<ProviderHealthSnapshot>;
};

export type ProviderRegistryListItem = Omit<RegisteredProvider, "healthCheck"> & {
  hasHealthCheck: boolean;
};

export class ProviderRegistry {
  private readonly providers = new Map<string, RegisteredProvider>();

  register(entry: RegisteredProvider): void {
    this.providers.set(entry.key, entry);
  }

  unregister(key: string): boolean {
    return this.providers.delete(key);
  }

  get(key: string): RegisteredProvider | undefined {
    return this.providers.get(key);
  }

  /** Lista metadados sem invocar healthCheck (sem SDKs externos). */
  list(): readonly ProviderRegistryListItem[] {
    return [...this.providers.values()].map(({ healthCheck: _hc, ...rest }) => ({
      ...rest,
      hasHealthCheck: true,
    }));
  }

  listByType(type: string): readonly ProviderRegistryListItem[] {
    return this.list().filter((p) => p.type === type);
  }

  /**
   * Executa healthCheck apenas nas instâncias já registradas.
   * Implementações NotConfigured* não chamam rede.
   */
  async healthCheckAll(): Promise<
    readonly (ProviderRegistryListItem & { health: ProviderHealthSnapshot })[]
  > {
    const results: (ProviderRegistryListItem & { health: ProviderHealthSnapshot })[] = [];
    for (const provider of this.providers.values()) {
      const { healthCheck, ...rest } = provider;
      const health = await healthCheck();
      results.push({ ...rest, hasHealthCheck: true, health });
    }
    return results;
  }
}

export function createProviderRegistry(
  entries: readonly RegisteredProvider[] = [],
): ProviderRegistry {
  const registry = new ProviderRegistry();
  for (const entry of entries) registry.register(entry);
  return registry;
}
