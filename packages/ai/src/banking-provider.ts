/**
 * Contas / extratos / saldos bancários externos (Open Finance, banco, CNAB).
 * Default: not_configured — nunca inventa saldo ou movimentação.
 */

export type BankingProviderHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type BankingAccountRecord = {
  externalAccountId: string;
  providerKey: string;
  name?: string | null;
  bankCode?: string | null;
  branch?: string | null;
  accountNumberMasked?: string | null;
  currency?: string;
};

export type ListBankingAccountsInput = {
  organizationId?: string;
  signal?: AbortSignal;
};

export type BankingAccountsPage = {
  providerKey: string;
  status: "ok" | "unavailable" | "not_configured";
  accounts: readonly BankingAccountRecord[];
};

export type ListBankingTransactionsInput = {
  organizationId?: string;
  externalAccountId?: string;
  from?: string;
  to?: string;
  signal?: AbortSignal;
};

export type BankingTransactionRecord = {
  externalTransactionId: string;
  occurredAt: string;
  amountCents: number;
  currency: string;
  description?: string | null;
  counterparty?: string | null;
};

export type BankingTransactionsPage = {
  providerKey: string;
  status: "ok" | "unavailable" | "not_configured";
  transactions: readonly BankingTransactionRecord[];
  nextCursor?: string | null;
};

export type GetBankingBalanceInput = {
  organizationId?: string;
  externalAccountId?: string;
  signal?: AbortSignal;
};

export type BankingBalanceRecord = {
  providerKey: string;
  status: "ok" | "unavailable" | "not_configured";
  externalAccountId: string | null;
  balanceCents: number | null;
  currency: string;
  asOf?: string | null;
  detail?: string;
};

export interface BankingProvider {
  readonly id: string;
  listAccounts(input: ListBankingAccountsInput): Promise<BankingAccountsPage>;
  listTransactions(input: ListBankingTransactionsInput): Promise<BankingTransactionsPage>;
  getBalance(input: GetBankingBalanceInput): Promise<BankingBalanceRecord>;
  healthCheck(): Promise<BankingProviderHealth>;
}

export class NotConfiguredBankingProvider implements BankingProvider {
  readonly id = "not_configured";

  listAccounts(_input: ListBankingAccountsInput): Promise<BankingAccountsPage> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      accounts: [],
    });
  }

  listTransactions(_input: ListBankingTransactionsInput): Promise<BankingTransactionsPage> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      transactions: [],
      nextCursor: null,
    });
  }

  getBalance(_input: GetBankingBalanceInput): Promise<BankingBalanceRecord> {
    // Nunca inventa saldo disponível.
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalAccountId: null,
      balanceCents: null,
      currency: "BRL",
      asOf: null,
      detail: "Provedor bancário não configurado.",
    });
  }

  healthCheck(): Promise<BankingProviderHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail:
        "Nenhum provedor bancário está configurado. Importe extratos manualmente ou concilie no ledger sem saldo inventado.",
      checkedAt: new Date().toISOString(),
    });
  }
}
