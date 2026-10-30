import { AppError } from "@verasjuris/types";

/**
 * Web Application Firewall / edge protection.
 * Default: not_configured — não afirma proteção WAF ativa.
 */

export type WafProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type WafRuleSummary = {
  ruleId: string;
  name: string;
  enabled: boolean;
};

export type WafConfigSnapshot = {
  providerKey: string;
  status: "active" | "disabled" | "not_configured";
  rules: readonly WafRuleSummary[];
  detail?: string;
};

export interface WafProvider {
  readonly id: string;
  getConfig(signal?: AbortSignal): Promise<WafConfigSnapshot>;
  healthCheck(): Promise<WafProviderHealth>;
}

const MESSAGE = "Nenhum WAF está configurado nesta infraestrutura.";

export class NotConfiguredWafProvider implements WafProvider {
  readonly id = "not_configured";

  getConfig(_signal?: AbortSignal): Promise<WafConfigSnapshot> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      rules: [],
      detail: MESSAGE,
    });
  }

  healthCheck(): Promise<WafProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function wafProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
