import { AppError } from "@verasjuris/types";

/**
 * CRM externo (HubSpot, Salesforce, etc.).
 * Default: not_configured — nunca afirma sync de contatos/leads.
 */

export type CRMProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type CRMSyncKind = "contact" | "lead" | "opportunity";

export type CRMSyncInput = {
  organizationId?: string;
  kind: CRMSyncKind;
  records: readonly Record<string, unknown>[];
  signal?: AbortSignal;
};

export type CRMSyncResult = {
  providerKey: string;
  status: "synced" | "partial" | "failed" | "not_configured";
  syncedCount: number;
  detail?: string;
};

export type CRMWebhookVerifyInput = {
  headers: Record<string, string | string[] | undefined>;
  rawBody: Uint8Array | string;
};

export type CRMWebhookVerifyResult = {
  ok: boolean;
  reason?: string;
};

export interface CRMProvider {
  readonly id: string;
  syncContacts(input: Omit<CRMSyncInput, "kind">): Promise<CRMSyncResult>;
  syncLeads(input: Omit<CRMSyncInput, "kind">): Promise<CRMSyncResult>;
  syncOpportunities(input: Omit<CRMSyncInput, "kind">): Promise<CRMSyncResult>;
  verifyWebhook?(input: CRMWebhookVerifyInput): Promise<CRMWebhookVerifyResult>;
  healthCheck(): Promise<CRMProviderHealth>;
}

const MESSAGE = "Nenhum provedor de CRM externo está configurado.";

function notConfiguredSync(): CRMSyncResult {
  return {
    providerKey: "not_configured",
    status: "not_configured",
    syncedCount: 0,
    detail: MESSAGE,
  };
}

export class NotConfiguredCRMProvider implements CRMProvider {
  readonly id = "not_configured";

  syncContacts(_input: Omit<CRMSyncInput, "kind">): Promise<CRMSyncResult> {
    return Promise.resolve(notConfiguredSync());
  }

  syncLeads(_input: Omit<CRMSyncInput, "kind">): Promise<CRMSyncResult> {
    return Promise.resolve(notConfiguredSync());
  }

  syncOpportunities(_input: Omit<CRMSyncInput, "kind">): Promise<CRMSyncResult> {
    return Promise.resolve(notConfiguredSync());
  }

  verifyWebhook(_input: CRMWebhookVerifyInput): Promise<CRMWebhookVerifyResult> {
    return Promise.resolve({ ok: false, reason: MESSAGE });
  }

  healthCheck(): Promise<CRMProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function crmProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
