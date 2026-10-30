import { AppError } from "@verasjuris/types";

/**
 * CI/CD / deployment externo.
 * Default: not_configured — nunca finge deploy publicado ou rollback.
 */

export type DeploymentProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type DeploymentStatus =
  | "queued"
  | "deploying"
  | "succeeded"
  | "failed"
  | "rolled_back"
  | "cancelled"
  | "not_configured";

export type TriggerDeploymentInput = {
  organizationId?: string;
  environment: string;
  version?: string;
  commitReference?: string;
  metadata?: Record<string, string>;
  signal?: AbortSignal;
};

export type DeploymentRecord = {
  providerKey: string;
  status: DeploymentStatus;
  externalDeploymentId: string | null;
  environment: string;
  version?: string | null;
  commitReference?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  detail?: string;
};

export type GetDeploymentInput = {
  organizationId?: string;
  externalDeploymentId: string;
  signal?: AbortSignal;
};

export interface DeploymentProvider {
  readonly id: string;
  triggerDeployment(input: TriggerDeploymentInput): Promise<DeploymentRecord>;
  getDeployment(input: GetDeploymentInput): Promise<DeploymentRecord>;
  healthCheck(): Promise<DeploymentProviderHealth>;
}

const MESSAGE =
  "Nenhum provedor de deployment/CI está configurado. Releases internas não afirmam publicação externa.";

export class NotConfiguredDeploymentProvider implements DeploymentProvider {
  readonly id = "not_configured";

  triggerDeployment(input: TriggerDeploymentInput): Promise<DeploymentRecord> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalDeploymentId: null,
      environment: input.environment,
      version: input.version ?? null,
      commitReference: input.commitReference ?? null,
      startedAt: null,
      finishedAt: null,
      detail: MESSAGE,
    });
  }

  getDeployment(input: GetDeploymentInput): Promise<DeploymentRecord> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalDeploymentId: input.externalDeploymentId,
      environment: "",
      version: null,
      commitReference: null,
      startedAt: null,
      finishedAt: null,
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<DeploymentProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function deploymentProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
