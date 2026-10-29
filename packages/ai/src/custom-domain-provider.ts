import { AppError } from "@verasjuris/types";

/**
 * Domínio customizado / white-label (DNS + attach).
 * Default: not_configured — nunca afirma ownership ou attach bem-sucedido.
 */

export type CustomDomainHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type VerifyDomainOwnershipInput = {
  organizationId?: string;
  domain: string;
  signal?: AbortSignal;
};

export type DomainOwnershipResult = {
  providerKey: string;
  status: "pending" | "verified" | "failed" | "not_configured";
  domain: string;
  verificationToken?: string | null;
  dnsRecords?: readonly { type: string; name: string; value: string }[];
  detail?: string;
};

export type AttachDomainInput = {
  organizationId?: string;
  domain: string;
  signal?: AbortSignal;
};

export type AttachDomainResult = {
  providerKey: string;
  status: "attached" | "pending" | "failed" | "not_configured";
  domain: string;
  detail?: string;
};

export interface CustomDomainProvider {
  readonly id: string;
  verifyDomainOwnership(input: VerifyDomainOwnershipInput): Promise<DomainOwnershipResult>;
  attachDomain(input: AttachDomainInput): Promise<AttachDomainResult>;
  healthCheck(): Promise<CustomDomainHealth>;
}

const MESSAGE =
  "Nenhum provedor de domínio customizado está configurado. White-label/DNS permanece indisponível até configuração real.";

export class NotConfiguredCustomDomainProvider implements CustomDomainProvider {
  readonly id = "not_configured";

  verifyDomainOwnership(input: VerifyDomainOwnershipInput): Promise<DomainOwnershipResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      domain: input.domain,
      verificationToken: null,
      dnsRecords: [],
      detail: "Provedor de domínio customizado não configurado.",
    });
  }

  attachDomain(_input: AttachDomainInput): Promise<AttachDomainResult> {
    return Promise.reject(new AppError("CUSTOM_DOMAIN_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<CustomDomainHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor de domínio customizado não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
