import { AppError } from "@verasjuris/types";

/**
 * Provedor de cartórios/registros públicos (ONR, e-Notariado, etc.).
 * Default: not_configured. Sem integração fictícia.
 */

export type RegistryHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type RegistryEntryRecord = {
  externalId: string;
  registryType: string | null;
  registrationNumber: string | null;
  jurisdiction: string | null;
  status: string | null;
  provider: string;
};

export type RegistryDocumentRecord = {
  externalId: string;
  documentKind: string | null;
  issuedAt: string | null;
  metadata: Record<string, string>;
  provider: string;
};

export type RegistryOfficeSearchResult = {
  externalId: string;
  name: string;
  officeType: string | null;
  state: string | null;
  city: string | null;
  provider: string;
};

export type RegistryServiceTypeRecord = {
  key: string;
  name: string;
  provider: string;
};

export type RegistryQuoteInput = {
  serviceTypeKey: string;
  officeExternalId?: string;
  state?: string;
  city?: string;
  signal?: AbortSignal;
};

export type RegistryQuoteResult = {
  providerKey: string;
  serviceFeeCents: number | null;
  officialFeesCents: number | null;
  totalEstimateCents: number | null;
  estimatedDeliveryAt: string | null;
  detail?: string;
};

export type RegistrySubmitInput = {
  serviceTypeKey: string;
  officeExternalId?: string;
  payload: Record<string, unknown>;
  signal?: AbortSignal;
};

export type RegistrySubmitResult = {
  providerKey: string;
  externalProtocol: string | null;
  status: string;
  detail?: string;
};

export type RegistryStatusResult = {
  providerKey: string;
  externalProtocol: string;
  status: string;
  detail?: string;
};

export interface RegistryProvider {
  readonly id: string;
  readonly key: string;
  readonly type: "registry";
  readonly status: "configured" | "not_configured" | "degraded" | "failed";
  readonly capabilities: readonly string[];
  fetchEntry(externalId: string, signal?: AbortSignal): Promise<RegistryEntryRecord | null>;
  searchEntries(query: {
    registrationNumber?: string;
    registryType?: string;
    signal?: AbortSignal;
  }): Promise<RegistryEntryRecord[]>;
  fetchDocument(externalId: string, signal?: AbortSignal): Promise<RegistryDocumentRecord | null>;
  searchOffice(query: {
    state?: string;
    city?: string;
    name?: string;
    signal?: AbortSignal;
  }): Promise<RegistryOfficeSearchResult[]>;
  getServiceTypes(signal?: AbortSignal): Promise<RegistryServiceTypeRecord[]>;
  quote(input: RegistryQuoteInput): Promise<RegistryQuoteResult>;
  submitRequest(input: RegistrySubmitInput): Promise<RegistrySubmitResult>;
  requestStatus(externalProtocol: string, signal?: AbortSignal): Promise<RegistryStatusResult>;
  downloadResult(
    externalProtocol: string,
    signal?: AbortSignal,
  ): Promise<RegistryDocumentRecord | null>;
  cancel(externalProtocol: string, signal?: AbortSignal): Promise<void>;
  healthCheck(): Promise<RegistryHealth>;
}

const MESSAGE =
  "Nenhum provedor de registros/cartórios está configurado. Nenhum protocolo ou emolumento oficial foi obtido.";

function rejectNotConfigured<T>(): Promise<T> {
  return Promise.reject(new AppError("REGISTRY_PROVIDER_NOT_CONFIGURED", MESSAGE));
}

export class NotConfiguredRegistryProvider implements RegistryProvider {
  readonly id = "not_configured";
  readonly key = "not_configured";
  readonly type = "registry" as const;
  readonly status = "not_configured" as const;
  readonly capabilities = [
    "searchOffice",
    "getServiceTypes",
    "quote",
    "submitRequest",
    "status",
    "downloadResult",
    "cancel",
    "healthCheck",
  ] as const;

  fetchEntry(_externalId: string, _signal?: AbortSignal): Promise<RegistryEntryRecord | null> {
    return rejectNotConfigured();
  }

  searchEntries(_query: {
    registrationNumber?: string;
    registryType?: string;
    signal?: AbortSignal;
  }): Promise<RegistryEntryRecord[]> {
    return rejectNotConfigured();
  }

  fetchDocument(
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<RegistryDocumentRecord | null> {
    return rejectNotConfigured();
  }

  searchOffice(_query: {
    state?: string;
    city?: string;
    name?: string;
    signal?: AbortSignal;
  }): Promise<RegistryOfficeSearchResult[]> {
    return rejectNotConfigured();
  }

  getServiceTypes(_signal?: AbortSignal): Promise<RegistryServiceTypeRecord[]> {
    return rejectNotConfigured();
  }

  quote(_input: RegistryQuoteInput): Promise<RegistryQuoteResult> {
    return rejectNotConfigured();
  }

  submitRequest(_input: RegistrySubmitInput): Promise<RegistrySubmitResult> {
    return rejectNotConfigured();
  }

  requestStatus(_externalProtocol: string, _signal?: AbortSignal): Promise<RegistryStatusResult> {
    return rejectNotConfigured();
  }

  downloadResult(
    _externalProtocol: string,
    _signal?: AbortSignal,
  ): Promise<RegistryDocumentRecord | null> {
    return rejectNotConfigured();
  }

  cancel(_externalProtocol: string, _signal?: AbortSignal): Promise<void> {
    return rejectNotConfigured();
  }

  healthCheck(): Promise<RegistryHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de registros/cartórios não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
