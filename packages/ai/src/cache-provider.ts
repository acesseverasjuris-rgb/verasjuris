import { AppError } from "@verasjuris/types";

/**
 * Cache — in-memory para testes; distributed default not_configured.
 */

export type CacheProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type CacheGetResult<T> = {
  hit: boolean;
  value: T | null;
};

export interface CacheProvider {
  readonly id: string;
  get<T = unknown>(key: string): Promise<CacheGetResult<T>>;
  set(key: string, value: unknown, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear?(prefix?: string): Promise<void>;
  healthCheck(): Promise<CacheProviderHealth>;
}

type Entry = { value: unknown; expiresAt: number | null };

/** Cache em memória — adequado a testes e processo único. */
export class InMemoryCacheProvider implements CacheProvider {
  readonly id = "in_memory";
  private readonly store = new Map<string, Entry>();

  get<T = unknown>(key: string): Promise<CacheGetResult<T>> {
    const entry = this.store.get(key);
    if (!entry) return Promise.resolve({ hit: false, value: null });
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return Promise.resolve({ hit: false, value: null });
    }
    return Promise.resolve({ hit: true, value: entry.value as T });
  }

  set(key: string, value: unknown, ttlMs?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlMs && ttlMs > 0 ? Date.now() + ttlMs : null,
    });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  clear(prefix?: string): Promise<void> {
    if (!prefix) {
      this.store.clear();
      return Promise.resolve();
    }
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
    return Promise.resolve();
  }

  healthCheck(): Promise<CacheProviderHealth> {
    return Promise.resolve({
      status: "ok",
      detail: "Cache em memória local.",
      checkedAt: new Date().toISOString(),
    });
  }
}

const DISTRIBUTED_MESSAGE =
  "Nenhum cache distribuído está configurado. Use InMemoryCacheProvider apenas em processo único/testes.";

export class NotConfiguredDistributedCacheProvider implements CacheProvider {
  readonly id = "not_configured";

  get<T = unknown>(_key: string): Promise<CacheGetResult<T>> {
    return Promise.resolve({ hit: false, value: null });
  }

  set(_key: string, _value: unknown, _ttlMs?: number): Promise<void> {
    return Promise.resolve();
  }

  delete(_key: string): Promise<void> {
    return Promise.resolve();
  }

  healthCheck(): Promise<CacheProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: DISTRIBUTED_MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function distributedCacheProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", DISTRIBUTED_MESSAGE);
}
