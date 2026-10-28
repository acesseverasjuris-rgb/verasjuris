import { AppError } from "@verasjuris/types";

/**
 * Assinatura eletrônica via provedor externo (DocuSign, Clicksign, etc.).
 * Default: not_configured — nunca simular assinatura concluída.
 */

export type SignatureProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type ContractManagementHealth = SignatureProviderHealth;

export type SignatureEnvelopeStatus =
  | "draft"
  | "ready"
  | "sent"
  | "viewed"
  | "partially_signed"
  | "signed"
  | "declined"
  | "expired"
  | "cancelled"
  | "failed"
  | "not_configured";

export type SignatureEnvelope = {
  externalEnvelopeId: string | null;
  status: SignatureEnvelopeStatus;
  providerKey: string;
  completedAt?: string | null;
};

export type SignatureSignerRef = {
  externalSignerId?: string | null;
  name: string;
  email?: string | null;
  signingOrder?: number;
};

export type CreateSignatureEnvelopeInput = {
  contractId: string;
  contractVersionId: string;
  title: string;
  documentReference?: string | null;
  expiresAt?: string | null;
  signal?: AbortSignal;
};

export type SendSignatureEnvelopeInput = {
  externalEnvelopeId: string;
  signal?: AbortSignal;
};

export type SignatureEvidence = {
  mimeType: string;
  body: Uint8Array | string;
  filenameHint?: string;
};

export interface SignatureProvider {
  readonly id: string;
  createEnvelope(input: CreateSignatureEnvelopeInput): Promise<SignatureEnvelope>;
  addSigner(
    externalEnvelopeId: string,
    signer: SignatureSignerRef,
    signal?: AbortSignal,
  ): Promise<void>;
  send(input: SendSignatureEnvelopeInput): Promise<SignatureEnvelope>;
  getStatus(externalEnvelopeId: string, signal?: AbortSignal): Promise<SignatureEnvelope>;
  cancel(externalEnvelopeId: string, signal?: AbortSignal): Promise<void>;
  downloadEvidence(externalEnvelopeId: string, signal?: AbortSignal): Promise<SignatureEvidence>;
  healthCheck(): Promise<SignatureProviderHealth>;
}

export type SyncExternalContractInput = {
  organizationId: string;
  contractId: string;
  externalReference?: string | null;
  signal?: AbortSignal;
};

export type ExternalContractSnapshot = {
  externalId: string | null;
  status: "linked" | "not_configured" | "unavailable";
  detail?: string;
};

export interface ContractManagementProvider {
  readonly id: string;
  syncExternalContract(input: SyncExternalContractInput): Promise<ExternalContractSnapshot>;
  healthCheck(): Promise<ContractManagementHealth>;
}

const SIGNATURE_MESSAGE =
  "Nenhum provedor de assinatura eletrônica está configurado. Use registro manual de assinatura com evidência documental.";

const CONTRACT_MGMT_MESSAGE = "Nenhum provedor de gestão contratual externa está configurado.";

function notConfiguredEnvelope(): SignatureEnvelope {
  return {
    externalEnvelopeId: null,
    status: "not_configured",
    providerKey: "not_configured",
    completedAt: null,
  };
}

export class NotConfiguredSignatureProvider implements SignatureProvider {
  readonly id = "not_configured";

  createEnvelope(_input: CreateSignatureEnvelopeInput): Promise<SignatureEnvelope> {
    return Promise.resolve(notConfiguredEnvelope());
  }

  addSigner(_externalEnvelopeId: string, _signer: SignatureSignerRef): Promise<void> {
    return Promise.reject(new AppError("SIGNATURE_PROVIDER_NOT_CONFIGURED", SIGNATURE_MESSAGE));
  }

  send(_input: SendSignatureEnvelopeInput): Promise<SignatureEnvelope> {
    return Promise.resolve(notConfiguredEnvelope());
  }

  getStatus(_externalEnvelopeId: string): Promise<SignatureEnvelope> {
    return Promise.resolve(notConfiguredEnvelope());
  }

  cancel(_externalEnvelopeId: string): Promise<void> {
    return Promise.reject(new AppError("SIGNATURE_PROVIDER_NOT_CONFIGURED", SIGNATURE_MESSAGE));
  }

  downloadEvidence(_externalEnvelopeId: string): Promise<SignatureEvidence> {
    return Promise.reject(new AppError("SIGNATURE_PROVIDER_NOT_CONFIGURED", SIGNATURE_MESSAGE));
  }

  healthCheck(): Promise<SignatureProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de assinatura não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}

export class NotConfiguredContractManagementProvider implements ContractManagementProvider {
  readonly id = "not_configured";

  syncExternalContract(_input: SyncExternalContractInput): Promise<ExternalContractSnapshot> {
    return Promise.reject(
      new AppError("CONTRACT_MANAGEMENT_PROVIDER_NOT_CONFIGURED", CONTRACT_MGMT_MESSAGE),
    );
  }

  healthCheck(): Promise<ContractManagementHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de gestão contratual não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
