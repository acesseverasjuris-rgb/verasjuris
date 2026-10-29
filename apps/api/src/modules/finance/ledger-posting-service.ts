import {
  isUniqueViolation,
  ledgerAccounts,
  ledgerEntries,
  ledgerTransactions,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, eq, inArray } from "drizzle-orm";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];
type Db = AppDatabase | DbTx;

export const SYSTEM_ACCOUNT_KEYS = [
  "CASH_CLEARING",
  "PAYMENT_RECEIVABLE",
  "CUSTOMER_CREDIT_LIABILITY",
  "PROFESSIONAL_PAYABLE",
  "PLATFORM_REVENUE",
  "PROCESSING_FEE_EXPENSE",
  "REFUND_PAYABLE",
  "CHARGEBACK_CLEARING",
] as const;

export type SystemAccountKey = (typeof SYSTEM_ACCOUNT_KEYS)[number];

const SYSTEM_ACCOUNT_DEFS: Record<
  SystemAccountKey,
  { code: string; name: string; type: (typeof ledgerAccounts.$inferInsert)["type"] }
> = {
  CASH_CLEARING: { code: "1000", name: "Caixa / Clearing", type: "clearing" },
  PAYMENT_RECEIVABLE: { code: "1100", name: "Contas a receber", type: "asset" },
  CUSTOMER_CREDIT_LIABILITY: {
    code: "2100",
    name: "Créditos de clientes",
    type: "liability",
  },
  PROFESSIONAL_PAYABLE: { code: "2200", name: "Repasses a profissionais", type: "liability" },
  PLATFORM_REVENUE: { code: "4000", name: "Receita da plataforma", type: "revenue" },
  PROCESSING_FEE_EXPENSE: { code: "5100", name: "Taxas de processamento", type: "expense" },
  REFUND_PAYABLE: { code: "2300", name: "Reembolsos a pagar", type: "liability" },
  CHARGEBACK_CLEARING: { code: "1200", name: "Chargeback clearing", type: "clearing" },
};

export type LedgerEntryInput = {
  accountId: string;
  direction: "debit" | "credit";
  amountCents: number;
  currency?: string;
  metadata?: Record<string, unknown>;
};

export type PostLedgerInput = {
  organizationId: string;
  transactionType: (typeof ledgerTransactions.$inferInsert)["transactionType"];
  referenceType?: string | null;
  referenceId?: string | null;
  currency: string;
  occurredAt?: Date;
  idempotencyKey: string;
  description?: string | null;
  reason?: string | null;
  createdByMembershipId?: string | null;
  entries: LedgerEntryInput[];
  reversalOfTransactionId?: string | null;
};

function assertBalanced(entries: LedgerEntryInput[], currency: string) {
  if (entries.length < 2) {
    throw new AppError("VALIDATION_ERROR", "Lançamento exige no mínimo dois entries.", [
      { path: "entries", message: "Informe ao menos dois lançamentos." },
    ]);
  }
  let debit = 0;
  let credit = 0;
  for (const entry of entries) {
    if (!Number.isInteger(entry.amountCents) || entry.amountCents <= 0) {
      throw new AppError("VALIDATION_ERROR", "Valores do ledger devem ser centavos positivos.", [
        { path: "entries.amountCents", message: "Informe um inteiro positivo em centavos." },
      ]);
    }
    const entryCurrency = entry.currency ?? currency;
    if (entryCurrency !== currency) {
      throw new AppError("VALIDATION_ERROR", "Todos os lançamentos devem usar a mesma moeda.", [
        { path: "entries.currency", message: `Esperado ${currency}.` },
      ]);
    }
    if (entry.direction === "debit") debit += entry.amountCents;
    else credit += entry.amountCents;
  }
  if (debit !== credit) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Lançamentos devem equilibrar débitos e créditos (centavos).",
      [{ path: "entries", message: `Débito ${debit} ≠ crédito ${credit}.` }],
    );
  }
}

/**
 * Único ponto autorizado a postar entries no ledger.
 * Double-entry e imutabilidade de POSTED vivem aqui.
 */
export class LedgerPostingService {
  constructor(private readonly db: AppDatabase) {}

  async ensureSystemAccounts(
    organizationId: string,
    currency = "BRL",
    db: Db = this.db,
  ): Promise<Record<SystemAccountKey, typeof ledgerAccounts.$inferSelect>> {
    const existing = await db.query.ledgerAccounts.findMany({
      where: and(
        eq(ledgerAccounts.organizationId, organizationId),
        eq(ledgerAccounts.systemAccount, true),
      ),
    });
    const byKey = new Map(
      existing
        .filter((row) => row.systemKey)
        .map((row) => [row.systemKey as SystemAccountKey, row]),
    );

    for (const key of SYSTEM_ACCOUNT_KEYS) {
      if (byKey.has(key)) continue;
      const def = SYSTEM_ACCOUNT_DEFS[key];
      try {
        const [row] = await db
          .insert(ledgerAccounts)
          .values({
            organizationId,
            code: def.code,
            name: def.name,
            type: def.type,
            currency,
            active: true,
            systemAccount: true,
            systemKey: key,
          })
          .returning();
        byKey.set(key, row!);
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const again = await db.query.ledgerAccounts.findFirst({
          where: and(
            eq(ledgerAccounts.organizationId, organizationId),
            eq(ledgerAccounts.systemKey, key),
          ),
        });
        if (!again) throw error;
        byKey.set(key, again);
      }
    }

    const result = {} as Record<SystemAccountKey, typeof ledgerAccounts.$inferSelect>;
    for (const key of SYSTEM_ACCOUNT_KEYS) {
      const row = byKey.get(key);
      if (!row) {
        throw new AppError("INTERNAL_ERROR", `Conta sistema ${key} não pôde ser provisionada.`);
      }
      result[key] = row;
    }
    return result;
  }

  async getSystemAccount(
    organizationId: string,
    key: SystemAccountKey,
    currency = "BRL",
    db: Db = this.db,
  ) {
    const accounts = await this.ensureSystemAccounts(organizationId, currency, db);
    return accounts[key];
  }

  async post(input: PostLedgerInput, db: Db = this.db) {
    assertBalanced(input.entries, input.currency);

    const existing = await db.query.ledgerTransactions.findFirst({
      where: and(
        eq(ledgerTransactions.organizationId, input.organizationId),
        eq(ledgerTransactions.idempotencyKey, input.idempotencyKey),
      ),
      with: { entries: true },
    });
    if (existing) {
      if (existing.status === "posted" || existing.status === "reversed") {
        return existing;
      }
    }

    const accountIds = [...new Set(input.entries.map((e) => e.accountId))];
    const accounts = await db.query.ledgerAccounts.findMany({
      where: and(
        eq(ledgerAccounts.organizationId, input.organizationId),
        inArray(ledgerAccounts.id, accountIds),
      ),
    });
    if (accounts.length !== accountIds.length) {
      throw new AppError("VALIDATION_ERROR", "Uma ou mais contas do lançamento são inválidas.", [
        { path: "entries.accountId", message: "Conta não encontrada nesta organização." },
      ]);
    }
    for (const account of accounts) {
      if (!account.active) {
        throw new AppError("VALIDATION_ERROR", "Conta inativa não pode receber lançamento.", [
          { path: "entries.accountId", message: account.code },
        ]);
      }
      if (account.currency !== input.currency) {
        throw new AppError("VALIDATION_ERROR", "Moeda da conta diverge da transação.", [
          { path: "entries.accountId", message: account.code },
        ]);
      }
    }

    const now = new Date();
    try {
      const [txRow] = await db
        .insert(ledgerTransactions)
        .values({
          organizationId: input.organizationId,
          transactionType: input.transactionType,
          referenceType: input.referenceType ?? null,
          referenceId: input.referenceId ?? null,
          currency: input.currency,
          occurredAt: input.occurredAt ?? now,
          status: "posted",
          idempotencyKey: input.idempotencyKey,
          description: input.description ?? null,
          reason: input.reason ?? null,
          reversalOfTransactionId: input.reversalOfTransactionId ?? null,
          createdByMembershipId: input.createdByMembershipId ?? null,
          postedAt: now,
        })
        .returning();

      if (!txRow) {
        throw new AppError("INTERNAL_ERROR", "Falha ao criar transação do ledger.");
      }

      await db.insert(ledgerEntries).values(
        input.entries.map((entry) => ({
          transactionId: txRow.id,
          accountId: entry.accountId,
          direction: entry.direction,
          amountCents: entry.amountCents,
          currency: entry.currency ?? input.currency,
          metadata: entry.metadata ?? null,
        })),
      );

      const withEntries = await db.query.ledgerTransactions.findFirst({
        where: eq(ledgerTransactions.id, txRow.id),
        with: { entries: true },
      });
      if (!withEntries) {
        throw new AppError("INTERNAL_ERROR", "Transação do ledger não encontrada após posting.");
      }
      return withEntries;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const raced = await db.query.ledgerTransactions.findFirst({
        where: and(
          eq(ledgerTransactions.organizationId, input.organizationId),
          eq(ledgerTransactions.idempotencyKey, input.idempotencyKey),
        ),
        with: { entries: true },
      });
      if (!raced) throw error;
      return raced;
    }
  }

  async reverseLedgerTransaction(input: {
    organizationId: string;
    transactionId: string;
    reason: string;
    idempotencyKey: string;
    createdByMembershipId?: string | null;
  }) {
    return this.db.transaction(async (tx) => {
      const original = await tx.query.ledgerTransactions.findFirst({
        where: and(
          eq(ledgerTransactions.id, input.transactionId),
          eq(ledgerTransactions.organizationId, input.organizationId),
        ),
        with: { entries: true },
      });
      if (!original) {
        throw new AppError("NOT_FOUND", "Não encontramos esta transação do ledger.");
      }
      if (original.status === "reversed") {
        const existingReversal = await tx.query.ledgerTransactions.findFirst({
          where: and(
            eq(ledgerTransactions.organizationId, input.organizationId),
            eq(ledgerTransactions.reversalOfTransactionId, original.id),
          ),
          with: { entries: true },
        });
        if (existingReversal) return existingReversal;
      }
      if (original.status !== "posted") {
        throw new AppError("CONFLICT", "Somente transações postadas podem ser estornadas.");
      }
      if (!original.entries?.length) {
        throw new AppError("CONFLICT", "Transação sem entries não pode ser estornada.");
      }

      const reversal = await this.post(
        {
          organizationId: input.organizationId,
          transactionType: "reversal",
          referenceType: original.referenceType,
          referenceId: original.referenceId,
          currency: original.currency,
          occurredAt: new Date(),
          idempotencyKey: input.idempotencyKey,
          description: `Estorno de ${original.id}`,
          reason: input.reason,
          createdByMembershipId: input.createdByMembershipId ?? null,
          reversalOfTransactionId: original.id,
          entries: original.entries.map((entry) => ({
            accountId: entry.accountId,
            direction: entry.direction === "debit" ? ("credit" as const) : ("debit" as const),
            amountCents: entry.amountCents,
            currency: entry.currency,
            metadata: { reversalOfEntryId: entry.id },
          })),
        },
        tx,
      );

      await tx
        .update(ledgerTransactions)
        .set({ status: "reversed" })
        .where(eq(ledgerTransactions.id, original.id));

      return reversal;
    });
  }
}

export { assertBalanced as assertLedgerEntriesBalanced };
