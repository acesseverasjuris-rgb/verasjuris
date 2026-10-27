import { AppError } from "@verasjuris/types";

/**
 * FGTSProvider — futuro saldo/extrato oficial.
 * Default: not_configured. Sem provider: nunca afirmar saldo oficial.
 */

export type FGTSHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type FGTSBalanceRecord = {
  externalId: string;
  balanceCents: number | null;
  retrievedAt: string;
  provider: string;
};

export type FGTSStatementEntry = {
  externalId: string;
  competence: string | null;
  depositCents: number | null;
  occurredAt: string | null;
};

export interface FGTSProvider {
  readonly id: string;
  fetchBalance(query: {
    workerId?: string;
    signal?: AbortSignal;
  }): Promise<FGTSBalanceRecord | null>;
  fetchStatement(query: { workerId?: string; signal?: AbortSignal }): Promise<FGTSStatementEntry[]>;
  healthCheck(): Promise<FGTSHealth>;
}

const MESSAGE =
  "Nenhum provedor FGTS está configurado. Não afirme saldo oficial; use apenas estimativas e valores informados.";

export class NotConfiguredFGTSProvider implements FGTSProvider {
  readonly id = "not_configured";

  fetchBalance(_query: {
    workerId?: string;
    signal?: AbortSignal;
  }): Promise<FGTSBalanceRecord | null> {
    return Promise.reject(new AppError("FGTS_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  fetchStatement(_query: {
    workerId?: string;
    signal?: AbortSignal;
  }): Promise<FGTSStatementEntry[]> {
    return Promise.reject(new AppError("FGTS_PROVIDER_NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<FGTSHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: "Provedor FGTS não configurado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
