import { AppError } from "@verasjuris/types";

/**
 * SSO enterprise (SAML / OIDC).
 * Default: not_configured — nunca inventa autenticação federada.
 */

export type SSOProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type SSOProtocol = "saml" | "oidc";

export type SSOAuthStartInput = {
  organizationId: string;
  protocol: SSOProtocol;
  redirectUri: string;
  state: string;
  signal?: AbortSignal;
};

export type SSOAuthStartResult = {
  providerKey: string;
  status: "redirect" | "not_configured" | "failed";
  redirectUrl: string | null;
  detail?: string;
};

export type SSOAuthCallbackInput = {
  organizationId: string;
  protocol: SSOProtocol;
  query: Record<string, string>;
  body?: Record<string, string>;
  signal?: AbortSignal;
};

export type SSOAuthCallbackResult = {
  providerKey: string;
  status: "authenticated" | "failed" | "not_configured";
  externalSubjectId: string | null;
  email: string | null;
  displayName: string | null;
  attributes: Record<string, string>;
  detail?: string;
};

export interface SSOProvider {
  readonly id: string;
  startLogin(input: SSOAuthStartInput): Promise<SSOAuthStartResult>;
  handleCallback(input: SSOAuthCallbackInput): Promise<SSOAuthCallbackResult>;
  healthCheck(): Promise<SSOProviderHealth>;
}

const MESSAGE = "Nenhum provedor SSO (SAML/OIDC) está configurado.";

export class NotConfiguredSSOProvider implements SSOProvider {
  readonly id = "not_configured";

  startLogin(_input: SSOAuthStartInput): Promise<SSOAuthStartResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      redirectUrl: null,
      detail: MESSAGE,
    });
  }

  handleCallback(_input: SSOAuthCallbackInput): Promise<SSOAuthCallbackResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalSubjectId: null,
      email: null,
      displayName: null,
      attributes: {},
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<SSOProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function ssoProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
