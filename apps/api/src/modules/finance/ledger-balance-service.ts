import {
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
  type AppDatabase,
} from "@verasjuris/database";
import { and, eq, lte, sql } from "drizzle-orm";

/**
 * Saldos derivados exclusivamente de ledger_entries (nunca fonte primária armazenada).
 * Convenção: ativos/despesas/clearing → débito positivo; passivos/receitas/equity → crédito positivo.
 */
export class LedgerBalanceService {
  constructor(private readonly db: AppDatabase) {}

  async accountBalance(input: {
    organizationId: string;
    accountId: string;
    currency?: string;
    asOf?: Date;
  }) {
    const account = await this.db.query.ledgerAccounts.findFirst({
      where: and(
        eq(ledgerAccounts.id, input.accountId),
        eq(ledgerAccounts.organizationId, input.organizationId),
      ),
    });
    if (!account) return null;

    const currency = input.currency ?? account.currency;
    const filters = [
      eq(ledgerEntries.accountId, input.accountId),
      eq(ledgerEntries.currency, currency),
      eq(ledgerTransactions.organizationId, input.organizationId),
      eq(ledgerTransactions.status, "posted"),
    ];
    if (input.asOf) {
      filters.push(lte(ledgerTransactions.occurredAt, input.asOf));
    }

    const [row] = await this.db
      .select({
        debitCents: sql<string>`coalesce(sum(case when ${ledgerEntries.direction} = 'debit' then ${ledgerEntries.amountCents} else 0 end), 0)::text`,
        creditCents: sql<string>`coalesce(sum(case when ${ledgerEntries.direction} = 'credit' then ${ledgerEntries.amountCents} else 0 end), 0)::text`,
      })
      .from(ledgerEntries)
      .innerJoin(ledgerTransactions, eq(ledgerEntries.transactionId, ledgerTransactions.id))
      .where(and(...filters));

    const debitCents = Number(row?.debitCents ?? 0);
    const creditCents = Number(row?.creditCents ?? 0);
    const signed =
      account.type === "asset" || account.type === "expense" || account.type === "clearing"
        ? debitCents - creditCents
        : creditCents - debitCents;

    return {
      accountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      systemKey: account.systemKey,
      currency,
      debitCents,
      creditCents,
      balanceCents: signed,
      asOf: input.asOf?.toISOString() ?? null,
    };
  }

  async organizationBalances(input: { organizationId: string; currency?: string; asOf?: Date }) {
    const currency = input.currency ?? "BRL";
    const accounts = await this.db.query.ledgerAccounts.findMany({
      where: and(
        eq(ledgerAccounts.organizationId, input.organizationId),
        eq(ledgerAccounts.currency, currency),
        eq(ledgerAccounts.active, true),
      ),
    });

    const balances = [];
    for (const account of accounts) {
      const balance = await this.accountBalance({
        organizationId: input.organizationId,
        accountId: account.id,
        currency,
        asOf: input.asOf,
      });
      if (balance) balances.push(balance);
    }
    return { currency, asOf: input.asOf?.toISOString() ?? null, accounts: balances };
  }

  async cashClearingBalance(organizationId: string, currency = "BRL", asOf?: Date) {
    const account = await this.db.query.ledgerAccounts.findFirst({
      where: and(
        eq(ledgerAccounts.organizationId, organizationId),
        eq(ledgerAccounts.systemKey, "CASH_CLEARING"),
      ),
    });
    if (!account) {
      return { currency, balanceCents: 0, accountId: null as string | null };
    }
    const balance = await this.accountBalance({
      organizationId,
      accountId: account.id,
      currency,
      asOf,
    });
    return {
      currency,
      balanceCents: balance?.balanceCents ?? 0,
      accountId: account.id,
    };
  }
}
