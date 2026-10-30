import { AppError } from "@verasjuris/types";

/**
 * SCIM 2.0 provisioning.
 * Default: not_configured — create/update/deactivate apenas com adapter real.
 */

export type SCIMProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type SCIMUserInput = {
  organizationId: string;
  externalId?: string;
  userName: string;
  email: string;
  displayName?: string;
  active?: boolean;
  attributes?: Record<string, unknown>;
  signal?: AbortSignal;
};

export type SCIMUserRecord = {
  providerKey: string;
  status: "created" | "updated" | "deactivated" | "not_configured" | "failed";
  externalId: string | null;
  userName: string | null;
  active: boolean | null;
  detail?: string;
};

export interface SCIMProvider {
  readonly id: string;
  createUser(input: SCIMUserInput): Promise<SCIMUserRecord>;
  updateUser(externalId: string, input: SCIMUserInput): Promise<SCIMUserRecord>;
  deactivateUser(
    organizationId: string,
    externalId: string,
    signal?: AbortSignal,
  ): Promise<SCIMUserRecord>;
  healthCheck(): Promise<SCIMProviderHealth>;
}

const MESSAGE = "Nenhum provedor SCIM está configurado.";

function notConfigured(userName: string | null = null): SCIMUserRecord {
  return {
    providerKey: "not_configured",
    status: "not_configured",
    externalId: null,
    userName,
    active: null,
    detail: MESSAGE,
  };
}

export class NotConfiguredSCIMProvider implements SCIMProvider {
  readonly id = "not_configured";

  createUser(input: SCIMUserInput): Promise<SCIMUserRecord> {
    return Promise.resolve(notConfigured(input.userName));
  }

  updateUser(_externalId: string, input: SCIMUserInput): Promise<SCIMUserRecord> {
    return Promise.resolve(notConfigured(input.userName));
  }

  deactivateUser(
    _organizationId: string,
    _externalId: string,
    _signal?: AbortSignal,
  ): Promise<SCIMUserRecord> {
    return Promise.resolve(notConfigured(null));
  }

  healthCheck(): Promise<SCIMProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function scimProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
