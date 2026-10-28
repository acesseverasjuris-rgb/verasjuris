import { AppError } from "@verasjuris/types";

export type ConflictCheckHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type ConflictCheckParty = {
  displayName: string;
  documentReference?: string | null;
  role?: string | null;
};

export type ConflictCheckInput = {
  organizationId: string;
  parties: ConflictCheckParty[];
  matterSummary?: string | null;
  signal?: AbortSignal;
};

export type ConflictCheckFinding = {
  code: string;
  severity: "info" | "warning" | "blocking";
  message: string;
  relatedResourceType?: string | null;
  relatedResourceId?: string | null;
};

export type ConflictCheckResult = {
  providerKey: string;
  status: "clear" | "potential" | "conflict" | "not_configured" | "unavailable";
  findings: ConflictCheckFinding[];
  checkedAt: string;
};

export interface ConflictCheckProvider {
  readonly id: string;
  check(input: ConflictCheckInput): Promise<ConflictCheckResult>;
  healthCheck(): Promise<ConflictCheckHealth>;
}

const MESSAGE =
  "Nenhum provedor de verificação de conflitos está configurado. Realize conferência manual.";

export class NotConfiguredConflictCheckProvider implements ConflictCheckProvider {
  readonly id = "not_configured";

  check(_input: ConflictCheckInput): Promise<ConflictCheckResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      findings: [],
      checkedAt: new Date().toISOString(),
    });
  }

  healthCheck(): Promise<ConflictCheckHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function conflictCheckProviderNotConfiguredError(): AppError {
  return new AppError("CONFLICT_CHECK_PROVIDER_NOT_CONFIGURED", MESSAGE);
}
