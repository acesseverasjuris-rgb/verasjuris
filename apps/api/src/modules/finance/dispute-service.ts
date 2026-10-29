import type { PaymentDisputeProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import { policyFinancialDispute, type SessionAccount } from "@verasjuris/auth";
import {
  financialDisputeEvidence,
  financialDisputeHistory,
  financialDisputes,
  payables,
  paymentAllocations,
  payments,
  payouts,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { requireDocumentInOrg } from "../documents/service.js";
import { LedgerPostingService } from "./ledger-posting-service.js";

function serializeDispute(row: typeof financialDisputes.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    paymentId: row.paymentId,
    invoiceId: row.invoiceId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    disputeType: row.disputeType,
    openedByUserId: row.openedByUserId,
    amountCents: row.amountCents,
    currency: row.currency,
    reasonCode: row.reasonCode,
    description: row.description,
    status: row.status,
    providerKey: row.providerKey,
    externalDisputeId: row.externalDisputeId,
    holdApplied: row.holdApplied,
    resolvedAt: iso(row.resolvedAt),
    resolutionNote: row.resolutionNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Disputas financeiras / chargeback. Ledger effects only via new postings.
 * PaymentDisputeProvider default NOT_CONFIGURED — never fake won/lost via PSP.
 */
export class FinancialDisputeService {
  private readonly ledger: LedgerPostingService;

  constructor(
    private readonly db: AppDatabase,
    private readonly paymentDisputeProvider: PaymentDisputeProvider,
  ) {
    this.ledger = new LedgerPostingService(db);
  }

  async providerStatus() {
    return this.paymentDisputeProvider.healthCheck();
  }

  async list(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: string;
      disputeType?: string;
      paymentId?: string;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyFinancialDispute(m, "finance.dispute.read"));
    const filters: SQL[] = [eq(financialDisputes.organizationId, organizationId)];
    if (query.status) {
      filters.push(
        eq(
          financialDisputes.status,
          query.status as (typeof financialDisputes.$inferSelect)["status"],
        ),
      );
    }
    if (query.disputeType) {
      filters.push(
        eq(
          financialDisputes.disputeType,
          query.disputeType as (typeof financialDisputes.$inferSelect)["disputeType"],
        ),
      );
    }
    if (query.paymentId) filters.push(eq(financialDisputes.paymentId, query.paymentId));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.financialDisputes.findMany({
        where,
        orderBy: [desc(financialDisputes.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(financialDisputes).where(where),
    ]);
    return {
      items: items.map(serializeDispute),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async get(account: SessionAccount, organizationId: string, disputeId: string) {
    authorize(account, organizationId, (m) => policyFinancialDispute(m, "finance.dispute.read"));
    const dispute = await this.requireDispute(organizationId, disputeId);
    const [evidence, history] = await Promise.all([
      this.db.query.financialDisputeEvidence.findMany({
        where: eq(financialDisputeEvidence.disputeId, dispute.id),
        orderBy: [desc(financialDisputeEvidence.submittedAt)],
      }),
      this.db.query.financialDisputeHistory.findMany({
        where: eq(financialDisputeHistory.disputeId, dispute.id),
        orderBy: [desc(financialDisputeHistory.createdAt)],
      }),
    ]);
    return {
      dispute: serializeDispute(dispute),
      evidence: evidence.map((row) => ({
        id: row.id,
        documentId: row.documentId,
        evidenceType: row.evidenceType,
        submittedByUserId: row.submittedByUserId,
        submittedAt: row.submittedAt.toISOString(),
      })),
      history: history.map((row) => ({
        id: row.id,
        fromStatus: row.fromStatus,
        toStatus: row.toStatus,
        note: row.note,
        actorUserId: row.actorUserId,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async open(
    account: SessionAccount,
    organizationId: string,
    input: {
      paymentId?: string;
      invoiceId?: string;
      sourceType: string;
      sourceId?: string;
      disputeType: (typeof financialDisputes.$inferInsert)["disputeType"];
      amountCents: number;
      currency: string;
      reasonCode?: string;
      description?: string;
      providerKey?: string;
      externalDisputeId?: string;
      holdApplied?: boolean;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyFinancialDispute(m, "finance.dispute.manage"));

    if (input.paymentId) {
      const payment = await this.db.query.payments.findFirst({
        where: and(eq(payments.id, input.paymentId), eq(payments.organizationId, organizationId)),
      });
      if (!payment) throw new AppError("NOT_FOUND", "Não encontramos este pagamento.");
    }

    const health = await this.paymentDisputeProvider.healthCheck();
    const configured =
      health.status !== "not_configured" && this.paymentDisputeProvider.id !== "not_configured";
    const providerKey = configured
      ? (input.providerKey ?? this.paymentDisputeProvider.id)
      : "not_configured";

    const applyHold = input.holdApplied ?? true;

    const dispute = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(financialDisputes)
        .values({
          organizationId,
          paymentId: input.paymentId ?? null,
          invoiceId: input.invoiceId ?? null,
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          disputeType: input.disputeType,
          openedByUserId: account.user.id,
          amountCents: input.amountCents,
          currency: input.currency,
          reasonCode: input.reasonCode ?? null,
          description: input.description ?? null,
          status: "open",
          providerKey,
          externalDisputeId: input.externalDisputeId ?? null,
          holdApplied: applyHold,
        })
        .returning();

      await tx.insert(financialDisputeHistory).values({
        disputeId: row!.id,
        fromStatus: null,
        toStatus: "open",
        note: input.description ?? "Disputa aberta",
        actorUserId: account.user.id,
      });

      if (applyHold && input.paymentId) {
        await this.applyHolds(tx, organizationId, input.paymentId, row!.id, "Dispute hold");
        await tx
          .update(payments)
          .set({ status: "disputed", updatedAt: new Date() })
          .where(eq(payments.id, input.paymentId));
      }

      return row!;
    });

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.dispute_opened",
      resourceType: "financial_dispute",
      resourceId: dispute.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { amountCents: dispute.amountCents, holdApplied: applyHold },
    });

    return { dispute: serializeDispute(dispute) };
  }

  async addEvidence(
    account: SessionAccount,
    organizationId: string,
    disputeId: string,
    input: { documentId: string; evidenceType?: string },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyFinancialDispute(m, "finance.dispute.manage"));
    const dispute = await this.requireDispute(organizationId, disputeId);
    await requireDocumentInOrg(this.db, organizationId, input.documentId);

    const [evidence] = await this.db
      .insert(financialDisputeEvidence)
      .values({
        disputeId: dispute.id,
        documentId: input.documentId,
        evidenceType: input.evidenceType ?? "other",
        submittedByUserId: account.user.id,
      })
      .returning();

    await this.db.insert(financialDisputeHistory).values({
      disputeId: dispute.id,
      fromStatus: dispute.status,
      toStatus: dispute.status === "open" ? "evidence_required" : dispute.status,
      note: `Evidência anexada: ${input.documentId}`,
      actorUserId: account.user.id,
    });

    if (dispute.status === "open") {
      await this.db
        .update(financialDisputes)
        .set({ status: "under_review", updatedAt: new Date() })
        .where(eq(financialDisputes.id, dispute.id));
    }

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.dispute_evidence_added",
      resourceType: "financial_dispute",
      resourceId: dispute.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { documentId: input.documentId, evidenceId: evidence!.id },
    });

    return {
      evidence: {
        id: evidence!.id,
        documentId: evidence!.documentId,
        evidenceType: evidence!.evidenceType,
        submittedAt: evidence!.submittedAt.toISOString(),
      },
    };
  }

  async resolve(
    account: SessionAccount,
    organizationId: string,
    disputeId: string,
    input: {
      status: "won" | "lost" | "partially_won" | "resolved" | "closed";
      resolutionNote: string;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyFinancialDispute(m, "finance.dispute.resolve"));
    const dispute = await this.requireDispute(organizationId, disputeId);
    if (["won", "lost", "partially_won", "resolved", "closed"].includes(dispute.status)) {
      throw new AppError("CONFLICT", "Esta disputa já foi resolvida.");
    }

    // Chargeback via provider: if still not configured, do not invent PSP outcome —
    // internal resolve is allowed with explicit operator decision + ledger postings.
    const health = await this.paymentDisputeProvider.healthCheck();
    if (
      dispute.disputeType === "chargeback" &&
      dispute.externalDisputeId &&
      (health.status === "not_configured" || this.paymentDisputeProvider.id === "not_configured")
    ) {
      // Operator may still resolve internally; provider remains NOT_CONFIGURED.
      void 0;
    }

    const ledgerTxId = await this.postResolutionLedger(dispute, input.status);

    const [updated] = await this.db
      .update(financialDisputes)
      .set({
        status: input.status,
        resolutionNote: input.resolutionNote,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(financialDisputes.id, dispute.id))
      .returning();

    await this.db.insert(financialDisputeHistory).values({
      disputeId: dispute.id,
      fromStatus: dispute.status,
      toStatus: input.status,
      note: input.resolutionNote,
      actorUserId: account.user.id,
    });

    if (dispute.holdApplied && dispute.paymentId) {
      await this.releaseHolds(organizationId, dispute.paymentId, dispute.id);
      if (input.status === "lost" || input.status === "partially_won") {
        await this.db
          .update(payments)
          .set({
            status: input.status === "lost" ? "chargeback" : "partially_refunded",
            updatedAt: new Date(),
          })
          .where(eq(payments.id, dispute.paymentId));
      } else if (input.status === "won") {
        await this.db
          .update(payments)
          .set({ status: "confirmed", updatedAt: new Date() })
          .where(eq(payments.id, dispute.paymentId));
      }
    }

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "finance.dispute_resolved",
      resourceType: "financial_dispute",
      resourceId: dispute.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: input.status, ledgerTransactionId: ledgerTxId },
    });

    return { dispute: serializeDispute(updated!), ledgerTransactionId: ledgerTxId };
  }

  private async postResolutionLedger(
    dispute: typeof financialDisputes.$inferSelect,
    status: "won" | "lost" | "partially_won" | "resolved" | "closed",
  ): Promise<string | null> {
    if (status === "won" || status === "resolved" || status === "closed") {
      return null;
    }

    const amount =
      status === "partially_won" ? Math.floor(dispute.amountCents / 2) : dispute.amountCents;
    if (amount <= 0) return null;

    await this.ledger.ensureSystemAccounts(dispute.organizationId, dispute.currency);
    const cash = await this.ledger.getSystemAccount(
      dispute.organizationId,
      "CASH_CLEARING",
      dispute.currency,
    );
    const chargeback = await this.ledger.getSystemAccount(
      dispute.organizationId,
      "CHARGEBACK_CLEARING",
      dispute.currency,
    );

    // New posting only — never edit original payment ledger.
    const posted = await this.ledger.post({
      organizationId: dispute.organizationId,
      transactionType: "chargeback",
      referenceType: "financial_dispute",
      referenceId: dispute.id,
      currency: dispute.currency,
      idempotencyKey: `dispute_resolve:${dispute.id}:${status}`,
      description: `Disputa ${status} ${dispute.id}`,
      entries: [
        { accountId: chargeback.id, direction: "debit", amountCents: amount },
        { accountId: cash.id, direction: "credit", amountCents: amount },
      ],
    });
    return posted.id;
  }

  private async applyHolds(
    db: AppDatabase | Parameters<Parameters<AppDatabase["transaction"]>[0]>[0],
    organizationId: string,
    paymentId: string,
    disputeId: string,
    reason: string,
  ) {
    const relatedPayables = await db.query.payables.findMany({
      where: and(eq(payables.organizationId, organizationId)),
    });
    // Hold payables whose source allocation belongs to this payment.
    const allocations = await db.query.paymentAllocations.findMany({
      where: eq(paymentAllocations.paymentId, paymentId),
    });
    const allocationIds = new Set(allocations.map((a) => a.id));
    for (const payable of relatedPayables) {
      if (
        payable.sourceAllocationId &&
        allocationIds.has(payable.sourceAllocationId) &&
        payable.status !== "paid" &&
        payable.status !== "cancelled" &&
        payable.status !== "reversed"
      ) {
        await db
          .update(payables)
          .set({
            status: "held",
            holdReason: reason,
            heldByDisputeId: disputeId,
            updatedAt: new Date(),
          })
          .where(eq(payables.id, payable.id));
      }
    }

    const relatedPayouts = await db.query.payouts.findMany({
      where: and(eq(payouts.organizationId, organizationId)),
    });
    for (const payout of relatedPayouts) {
      if (
        payout.allocationId &&
        allocationIds.has(payout.allocationId) &&
        payout.status !== "paid" &&
        payout.status !== "cancelled"
      ) {
        await db
          .update(payouts)
          .set({ status: "held", holdReason: reason, updatedAt: new Date() })
          .where(eq(payouts.id, payout.id));
      }
    }
  }

  private async releaseHolds(organizationId: string, paymentId: string, disputeId: string) {
    const allocations = await this.db.query.paymentAllocations.findMany({
      where: eq(paymentAllocations.paymentId, paymentId),
    });
    const allocationIds = new Set(allocations.map((a) => a.id));

    const heldPayables = await this.db.query.payables.findMany({
      where: and(
        eq(payables.organizationId, organizationId),
        eq(payables.heldByDisputeId, disputeId),
      ),
    });
    for (const payable of heldPayables) {
      if (payable.sourceAllocationId && allocationIds.has(payable.sourceAllocationId)) {
        await this.db
          .update(payables)
          .set({
            status: "available",
            holdReason: null,
            heldByDisputeId: null,
            updatedAt: new Date(),
          })
          .where(eq(payables.id, payable.id));
      }
    }

    const heldPayouts = await this.db.query.payouts.findMany({
      where: and(eq(payouts.organizationId, organizationId), eq(payouts.status, "held")),
    });
    for (const payout of heldPayouts) {
      if (payout.allocationId && allocationIds.has(payout.allocationId)) {
        await this.db
          .update(payouts)
          .set({ status: "pending", holdReason: null, updatedAt: new Date() })
          .where(eq(payouts.id, payout.id));
      }
    }
  }

  private async requireDispute(organizationId: string, disputeId: string) {
    const dispute = await this.db.query.financialDisputes.findFirst({
      where: and(
        eq(financialDisputes.id, disputeId),
        eq(financialDisputes.organizationId, organizationId),
      ),
    });
    if (!dispute) throw new AppError("NOT_FOUND", "Não encontramos esta disputa.");
    return dispute;
  }
}
