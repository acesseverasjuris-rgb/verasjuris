import { recordAudit } from "@verasjuris/audit";
import {
  policyFinanceManage,
  policyLedgerAccount,
  policyLedgerTransaction,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  financialReconciliations,
  isUniqueViolation,
  ledgerAccounts,
  ledgerTransactions,
  type AppDatabase,
} from "@verasjuris/database";
import type { PaymentProvider } from "@verasjuris/ai";
import { AppError } from "@verasjuris/types";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { LedgerBalanceService } from "./ledger-balance-service.js";
import { LedgerPostingService, type LedgerEntryInput } from "./ledger-posting-service.js";

export class LedgerOps {
  readonly posting: LedgerPostingService;
  readonly balances: LedgerBalanceService;

  constructor(
    private readonly db: AppDatabase,
    private readonly paymentProvider?: PaymentProvider,
  ) {
    this.posting = new LedgerPostingService(db);
    this.balances = new LedgerBalanceService(db);
  }

  async listAccounts(
    account: SessionAccount,
    organizationId: string,
    query: {
      type?: string;
      active?: boolean;
      systemAccount?: boolean;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyLedgerAccount(m, "finance.ledger.read"));
    await this.posting.ensureSystemAccounts(organizationId);

    const filters: SQL[] = [eq(ledgerAccounts.organizationId, organizationId)];
    if (query.type) {
      filters.push(eq(ledgerAccounts.type, query.type as typeof ledgerAccounts.$inferSelect.type));
    }
    if (query.active !== undefined) filters.push(eq(ledgerAccounts.active, query.active));
    if (query.systemAccount !== undefined) {
      filters.push(eq(ledgerAccounts.systemAccount, query.systemAccount));
    }
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.ledgerAccounts.findMany({
        where,
        orderBy: [desc(ledgerAccounts.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(ledgerAccounts).where(where),
    ]);
    return {
      items: items.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createAccount(
    account: SessionAccount,
    organizationId: string,
    input: {
      code: string;
      name: string;
      type: (typeof ledgerAccounts.$inferInsert)["type"];
      currency: string;
      parentAccountId?: string;
      active: boolean;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyLedgerAccount(m, "finance.ledger.post"));
    try {
      const [row] = await this.db
        .insert(ledgerAccounts)
        .values({
          organizationId,
          code: input.code,
          name: input.name,
          type: input.type,
          currency: input.currency,
          parentAccountId: input.parentAccountId ?? null,
          active: input.active,
          systemAccount: false,
          systemKey: null,
        })
        .returning();

      await recordAudit(this.db, {
        actorUserId: account.user.id,
        organizationId,
        action: "ledger.manual_journal_posted",
        resourceType: "ledger_account",
        resourceId: row!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { code: input.code, type: input.type },
      });
      return { account: row };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Já existe uma conta com este código.");
      }
      throw error;
    }
  }

  async listTransactions(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: string;
      transactionType?: string;
      referenceType?: string;
      referenceId?: string;
      from?: string;
      to?: string;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyLedgerTransaction(m, "finance.ledger.read"));
    const filters: SQL[] = [eq(ledgerTransactions.organizationId, organizationId)];
    if (query.status) {
      filters.push(
        eq(
          ledgerTransactions.status,
          query.status as typeof ledgerTransactions.$inferSelect.status,
        ),
      );
    }
    if (query.transactionType) {
      filters.push(
        eq(
          ledgerTransactions.transactionType,
          query.transactionType as typeof ledgerTransactions.$inferSelect.transactionType,
        ),
      );
    }
    if (query.referenceType) {
      filters.push(eq(ledgerTransactions.referenceType, query.referenceType));
    }
    if (query.referenceId) {
      filters.push(eq(ledgerTransactions.referenceId, query.referenceId));
    }
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.ledgerTransactions.findMany({
        where,
        orderBy: [desc(ledgerTransactions.occurredAt)],
        limit: query.limit,
        offset: query.offset,
        with: { entries: true },
      }),
      this.db.select({ value: count() }).from(ledgerTransactions).where(where),
    ]);
    return {
      items: items.map((row) => ({
        id: row.id,
        organizationId: row.organizationId,
        transactionType: row.transactionType,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        currency: row.currency,
        occurredAt: row.occurredAt.toISOString(),
        status: row.status,
        idempotencyKey: row.idempotencyKey,
        description: row.description,
        reason: row.reason,
        reversalOfTransactionId: row.reversalOfTransactionId,
        createdByMembershipId: row.createdByMembershipId,
        createdAt: row.createdAt.toISOString(),
        postedAt: iso(row.postedAt),
        entries: row.entries.map((entry) => ({
          id: entry.id,
          accountId: entry.accountId,
          direction: entry.direction,
          amountCents: entry.amountCents,
          currency: entry.currency,
          metadata: entry.metadata,
          createdAt: entry.createdAt.toISOString(),
        })),
      })),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async manualJournal(
    account: SessionAccount,
    organizationId: string,
    input: {
      transactionType: (typeof ledgerTransactions.$inferInsert)["transactionType"];
      referenceType?: string;
      referenceId?: string;
      currency: string;
      occurredAt?: string;
      idempotencyKey: string;
      description?: string;
      reason?: string;
      entries: LedgerEntryInput[];
    },
    meta: RequestMeta,
  ) {
    const membership = authorize(account, organizationId, (m) =>
      policyLedgerTransaction(m, "finance.ledger.post"),
    );
    if (!input.reason || input.reason.trim().length < 3) {
      throw new AppError("VALIDATION_ERROR", "Informe o motivo do lançamento manual.", [
        { path: "reason", message: "Motivo obrigatório para journal manual." },
      ]);
    }
    await this.posting.ensureSystemAccounts(organizationId, input.currency);
    const posted = await this.posting.post({
      organizationId,
      transactionType:
        input.transactionType === "manual_journal" ? "manual_journal" : input.transactionType,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      currency: input.currency,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : undefined,
      idempotencyKey: input.idempotencyKey,
      description: input.description,
      reason: input.reason,
      createdByMembershipId: membership.membershipId,
      entries: input.entries,
    });

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "ledger.manual_journal_posted",
      resourceType: "ledger_transaction",
      resourceId: posted.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        transactionType: posted.transactionType,
        idempotencyKey: posted.idempotencyKey,
        reason: input.reason,
      },
    });
    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "ledger.transaction_posted",
      resourceType: "ledger_transaction",
      resourceId: posted.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: posted.status },
    });

    return { transaction: posted };
  }

  async reverse(
    account: SessionAccount,
    organizationId: string,
    transactionId: string,
    input: { reason: string; idempotencyKey: string },
    meta: RequestMeta,
  ) {
    const membership = authorize(account, organizationId, (m) =>
      policyLedgerTransaction(m, "finance.ledger.reverse"),
    );
    const reversal = await this.posting.reverseLedgerTransaction({
      organizationId,
      transactionId,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      createdByMembershipId: membership.membershipId,
    });

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "ledger.transaction_reversed",
      resourceType: "ledger_transaction",
      resourceId: transactionId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { reversalId: reversal.id, reason: input.reason },
    });

    return { transaction: reversal };
  }

  async getBalances(
    account: SessionAccount,
    organizationId: string,
    query: { accountId?: string; currency?: string; asOf?: string },
  ) {
    authorize(account, organizationId, (m) => policyLedgerAccount(m, "finance.ledger.read"));
    await this.posting.ensureSystemAccounts(organizationId, query.currency ?? "BRL");
    const asOf = query.asOf ? new Date(query.asOf) : undefined;
    if (query.accountId) {
      const balance = await this.balances.accountBalance({
        organizationId,
        accountId: query.accountId,
        currency: query.currency,
        asOf,
      });
      if (!balance) throw new AppError("NOT_FOUND", "Não encontramos esta conta.");
      return { balances: [balance] };
    }
    return this.balances.organizationBalances({
      organizationId,
      currency: query.currency,
      asOf,
    });
  }

  async listReconciliations(
    account: SessionAccount,
    organizationId: string,
    query: { status?: string; providerKey?: string; limit: number; offset: number },
  ) {
    authorize(account, organizationId, (m) => policyFinanceManage(m, "finance.reconcile"));
    const health = await this.paymentProvider?.healthCheck();
    const providerAbsent =
      !this.paymentProvider ||
      this.paymentProvider.id === "not_configured" ||
      health?.status === "not_configured";

    const filters: SQL[] = [eq(financialReconciliations.organizationId, organizationId)];
    if (query.status) {
      filters.push(
        eq(
          financialReconciliations.status,
          query.status as typeof financialReconciliations.$inferSelect.status,
        ),
      );
    }
    if (query.providerKey) {
      filters.push(eq(financialReconciliations.providerKey, query.providerKey));
    }
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.financialReconciliations.findMany({
        where,
        orderBy: [desc(financialReconciliations.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(financialReconciliations).where(where),
    ]);

    return {
      items,
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
      providerStatus: providerAbsent ? "not_configured" : (health?.status ?? "ok"),
    };
  }

  async createReconciliation(
    account: SessionAccount,
    organizationId: string,
    input: {
      providerKey?: string;
      externalReference?: string;
      ledgerTransactionId?: string;
      amountCents?: number | null;
      currency: string;
      status?: (typeof financialReconciliations.$inferInsert)["status"];
      notes?: string;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyFinanceManage(m, "finance.reconcile"));
    const health = await this.paymentProvider?.healthCheck();
    const providerAbsent =
      !this.paymentProvider ||
      this.paymentProvider.id === "not_configured" ||
      health?.status === "not_configured";

    const status = providerAbsent ? "not_configured" : (input.status ?? "unmatched");
    const [row] = await this.db
      .insert(financialReconciliations)
      .values({
        organizationId,
        providerKey: providerAbsent ? "not_configured" : (input.providerKey ?? "not_configured"),
        externalReference: input.externalReference ?? null,
        ledgerTransactionId: input.ledgerTransactionId ?? null,
        amountCents: input.amountCents ?? null,
        currency: input.currency,
        status,
        notes: input.notes ?? null,
      })
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "ledger.reconciliation_updated",
      resourceType: "financial_reconciliation",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status },
    });

    return {
      reconciliation: row,
      providerStatus: providerAbsent ? "not_configured" : (health?.status ?? "ok"),
    };
  }
}
