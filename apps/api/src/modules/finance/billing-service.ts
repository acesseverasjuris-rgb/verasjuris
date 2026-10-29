import { recordAudit } from "@verasjuris/audit";
import {
  policyFinanceManage,
  policyFinanceRead,
  policyInvoice,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  billingCredits,
  billingPlanFeatures,
  billingPlans,
  billingPlanVersions,
  costRecords,
  invoices,
  invoiceLines,
  isUniqueViolation,
  legalFeeAccruals,
  legalFeeAgreements,
  platformFeeRules,
  subscriptions,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, desc, eq, sql, type SQL } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { AccountsReceivableService } from "./accounts-receivable.js";
import { LedgerBalanceService } from "./ledger-balance-service.js";
import { LedgerPostingService } from "./ledger-posting-service.js";
import type { PaymentProvider } from "@verasjuris/ai";

function parseDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

async function auditBilling(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string | null,
  action: string,
  resourceType: string,
  resourceId: string,
  meta: RequestMeta,
  after?: Record<string, unknown>,
) {
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action,
    resourceType,
    resourceId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: after ?? null,
  });
}

function serializePlan(row: typeof billingPlans.$inferSelect) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    billingInterval: row.billingInterval,
    priceCents: row.priceCents,
    currency: row.currency,
    active: row.active,
    public: row.public,
    version: row.version,
    currentVersionId: row.currentVersionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeInvoice(row: typeof invoices.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    clientId: row.clientId,
    subscriptionId: row.subscriptionId,
    invoiceNumber: row.invoiceNumber,
    currency: row.currency,
    subtotalCents: row.subtotalCents,
    discountCents: row.discountCents,
    taxCents: row.taxCents,
    estimatedTaxCents: row.estimatedTaxCents,
    taxSource: row.taxSource,
    totalCents: row.totalCents,
    amountPaidCents: row.amountPaidCents,
    amountDueCents: row.amountDueCents,
    status: row.status,
    issuedAt: iso(row.issuedAt),
    dueAt: iso(row.dueAt),
    paidAt: iso(row.paidAt),
    externalReference: row.externalReference,
    periodKey: row.periodKey,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function computeInvoiceTotals(input: {
  subtotalCents: number;
  discountCents: number;
  taxCents: number;
  amountPaidCents?: number;
}) {
  const totalCents = Math.max(0, input.subtotalCents - input.discountCents + input.taxCents);
  const amountPaidCents = input.amountPaidCents ?? 0;
  return {
    totalCents,
    amountDueCents: Math.max(0, totalCents - amountPaidCents),
  };
}

export class BillingService {
  readonly ar: AccountsReceivableService;
  readonly balances: LedgerBalanceService;
  readonly ledger: LedgerPostingService;

  constructor(
    private readonly db: AppDatabase,
    private readonly paymentProvider?: PaymentProvider,
  ) {
    this.ar = new AccountsReceivableService(db);
    this.balances = new LedgerBalanceService(db);
    this.ledger = new LedgerPostingService(db);
  }

  /* ─── Plans ─── */

  async listPlans(
    account: SessionAccount,
    organizationId: string,
    query: { limit: number; offset: number },
  ) {
    authorize(account, organizationId, (m) => policyFinanceRead(m, "finance.read"));
    const where = undefined;
    const [items, totalRow] = await Promise.all([
      this.db.query.billingPlans.findMany({
        where,
        orderBy: [desc(billingPlans.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(billingPlans),
    ]);
    return {
      items: items.map(serializePlan),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createPlan(
    account: SessionAccount,
    organizationId: string,
    input: {
      key: string;
      name: string;
      description?: string;
      billingInterval: (typeof billingPlans.$inferInsert)["billingInterval"];
      priceCents: number;
      currency: string;
      active: boolean;
      public: boolean;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyFinanceManage(m, "finance.plan.manage"));
    try {
      const billingInterval = input.billingInterval ?? "monthly";
      const [plan] = await this.db
        .insert(billingPlans)
        .values({
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          billingInterval,
          priceCents: input.priceCents,
          currency: input.currency,
          active: input.active,
          public: input.public,
          version: 1,
        })
        .returning();

      const [version] = await this.db
        .insert(billingPlanVersions)
        .values({
          planId: plan!.id,
          version: 1,
          name: input.name,
          description: input.description ?? null,
          billingInterval,
          priceCents: input.priceCents,
          currency: input.currency,
          snapshotJson: {
            key: input.key,
            priceCents: input.priceCents,
            billingInterval,
          },
        })
        .returning();

      const [updated] = await this.db
        .update(billingPlans)
        .set({ currentVersionId: version!.id, updatedAt: new Date() })
        .where(eq(billingPlans.id, plan!.id))
        .returning();

      await auditBilling(
        this.db,
        account,
        organizationId,
        "billing.plan_created",
        "billing_plan",
        plan!.id,
        meta,
        { key: input.key, priceCents: input.priceCents },
      );

      return { plan: serializePlan(updated!), version };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Já existe um plano com esta chave.");
      }
      throw error;
    }
  }

  async createPlanVersion(
    account: SessionAccount,
    organizationId: string,
    planId: string,
    input: {
      name?: string;
      description?: string;
      billingInterval?: (typeof billingPlans.$inferInsert)["billingInterval"];
      priceCents?: number;
      currency?: string;
      effectiveFrom?: string;
      effectiveTo?: string | null;
      snapshotJson?: Record<string, unknown>;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyFinanceManage(m, "finance.plan.manage"));
    const plan = await this.db.query.billingPlans.findFirst({ where: eq(billingPlans.id, planId) });
    if (!plan) throw new AppError("NOT_FOUND", "Não encontramos este plano.");

    const nextVersion = plan.version + 1;
    const [version] = await this.db
      .insert(billingPlanVersions)
      .values({
        planId: plan.id,
        version: nextVersion,
        name: input.name ?? plan.name,
        description: input.description ?? plan.description,
        billingInterval: input.billingInterval ?? plan.billingInterval,
        priceCents: input.priceCents ?? plan.priceCents,
        currency: input.currency ?? plan.currency,
        effectiveFrom: parseDate(input.effectiveFrom) ?? new Date(),
        effectiveTo: parseDate(input.effectiveTo) ?? null,
        snapshotJson: input.snapshotJson ?? {
          key: plan.key,
          priceCents: input.priceCents ?? plan.priceCents,
        },
      })
      .returning();

    const [updated] = await this.db
      .update(billingPlans)
      .set({
        version: nextVersion,
        currentVersionId: version!.id,
        name: input.name ?? plan.name,
        description: input.description ?? plan.description,
        billingInterval: input.billingInterval ?? plan.billingInterval,
        priceCents: input.priceCents ?? plan.priceCents,
        currency: input.currency ?? plan.currency,
        updatedAt: new Date(),
      })
      .where(eq(billingPlans.id, plan.id))
      .returning();

    await auditBilling(
      this.db,
      account,
      organizationId,
      "billing.plan_created",
      "billing_plan_version",
      version!.id,
      meta,
      { planId, version: nextVersion },
    );

    return { plan: serializePlan(updated!), version };
  }

  async listPlanVersions(account: SessionAccount, organizationId: string, planId: string) {
    authorize(account, organizationId, (m) => policyFinanceRead(m, "finance.read"));
    const items = await this.db.query.billingPlanVersions.findMany({
      where: eq(billingPlanVersions.planId, planId),
      orderBy: [desc(billingPlanVersions.version)],
    });
    return { items };
  }

  async addPlanFeature(
    account: SessionAccount,
    organizationId: string,
    planId: string,
    input: {
      featureKey: string;
      limitType: (typeof billingPlanFeatures.$inferInsert)["limitType"];
      limitValue?: number | null;
      planVersionId?: string;
      metadata?: Record<string, unknown>;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyFinanceManage(m, "finance.plan.manage"));
    const plan = await this.db.query.billingPlans.findFirst({ where: eq(billingPlans.id, planId) });
    if (!plan) throw new AppError("NOT_FOUND", "Não encontramos este plano.");

    try {
      const [feature] = await this.db
        .insert(billingPlanFeatures)
        .values({
          planId,
          planVersionId: input.planVersionId ?? plan.currentVersionId,
          featureKey: input.featureKey,
          limitType: input.limitType,
          limitValue: input.limitValue ?? null,
          metadata: input.metadata ?? null,
        })
        .returning();
      await auditBilling(
        this.db,
        account,
        organizationId,
        "billing.plan_created",
        "billing_plan_feature",
        feature!.id,
        meta,
        { featureKey: input.featureKey },
      );
      return { feature };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Esta feature já existe neste plano.");
      }
      throw error;
    }
  }

  async listPlanFeatures(account: SessionAccount, organizationId: string, planId: string) {
    authorize(account, organizationId, (m) => policyFinanceRead(m, "finance.read"));
    const items = await this.db.query.billingPlanFeatures.findMany({
      where: eq(billingPlanFeatures.planId, planId),
      orderBy: [asc(billingPlanFeatures.featureKey)],
    });
    return { items };
  }

  /* ─── Subscriptions ─── */

  async listSubscriptions(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: string;
      planId?: string;
      userId?: string;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyFinanceRead(m, "finance.read"));
    const filters: SQL[] = [eq(subscriptions.organizationId, organizationId)];
    if (query.status)
      filters.push(
        eq(subscriptions.status, query.status as typeof subscriptions.$inferSelect.status),
      );
    if (query.planId) filters.push(eq(subscriptions.planId, query.planId));
    if (query.userId) filters.push(eq(subscriptions.userId, query.userId));

    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.subscriptions.findMany({
        where,
        orderBy: [desc(subscriptions.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(subscriptions).where(where),
    ]);
    return {
      items: items.map((row) => ({
        ...row,
        billingCycleAnchor: iso(row.billingCycleAnchor),
        currentPeriodStart: iso(row.currentPeriodStart),
        currentPeriodEnd: iso(row.currentPeriodEnd),
        cancelledAt: iso(row.cancelledAt),
        trialEndsAt: iso(row.trialEndsAt),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createSubscription(
    account: SessionAccount,
    organizationId: string,
    input: {
      userId?: string;
      planId: string;
      planVersionId: string;
      status: "incomplete" | "trialing" | "active";
      billingCycleAnchor?: string;
      currentPeriodStart?: string;
      currentPeriodEnd?: string;
      trialEndsAt?: string;
      providerKey?: string;
      externalSubscriptionId?: string;
    },
    meta: RequestMeta,
  ) {
    const membership = authorize(account, organizationId, (m) =>
      policyFinanceManage(m, "finance.subscription.manage"),
    );
    void membership;

    const plan = await this.db.query.billingPlans.findFirst({
      where: eq(billingPlans.id, input.planId),
    });
    if (!plan) throw new AppError("NOT_FOUND", "Não encontramos este plano.");
    const version = await this.db.query.billingPlanVersions.findFirst({
      where: and(
        eq(billingPlanVersions.id, input.planVersionId),
        eq(billingPlanVersions.planId, input.planId),
      ),
    });
    if (!version) throw new AppError("NOT_FOUND", "Não encontramos esta versão do plano.");

    try {
      const [row] = await this.db
        .insert(subscriptions)
        .values({
          organizationId,
          userId: input.userId ?? null,
          planId: input.planId,
          planVersionId: input.planVersionId,
          status: input.status,
          billingCycleAnchor: parseDate(input.billingCycleAnchor) ?? null,
          currentPeriodStart: parseDate(input.currentPeriodStart) ?? null,
          currentPeriodEnd: parseDate(input.currentPeriodEnd) ?? null,
          trialEndsAt: parseDate(input.trialEndsAt) ?? null,
          providerKey: input.providerKey ?? "not_configured",
          externalSubscriptionId: input.externalSubscriptionId ?? null,
        })
        .returning();

      await auditBilling(
        this.db,
        account,
        organizationId,
        "billing.subscription_created",
        "subscription",
        row!.id,
        meta,
        { planId: input.planId, status: input.status },
      );
      return { subscription: row };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Assinatura externa já registrada.");
      }
      throw error;
    }
  }

  async cancelSubscription(
    account: SessionAccount,
    organizationId: string,
    subscriptionId: string,
    input: { atPeriodEnd: boolean; cancelledAt?: string },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) =>
      policyFinanceManage(m, "finance.subscription.manage"),
    );
    const existing = await this.db.query.subscriptions.findFirst({
      where: and(
        eq(subscriptions.id, subscriptionId),
        eq(subscriptions.organizationId, organizationId),
      ),
    });
    if (!existing) throw new AppError("NOT_FOUND", "Não encontramos esta assinatura.");

    const cancelledAt = parseDate(input.cancelledAt) ?? new Date();
    const [row] = await this.db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: input.atPeriodEnd,
        cancelledAt,
        status: input.atPeriodEnd ? existing.status : "cancelled",
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscriptionId))
      .returning();

    await auditBilling(
      this.db,
      account,
      organizationId,
      "billing.subscription_cancelled",
      "subscription",
      subscriptionId,
      meta,
      { atPeriodEnd: input.atPeriodEnd },
    );
    return { subscription: row };
  }

  /* ─── Invoices ─── */

  async listInvoices(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: string;
      clientId?: string;
      subscriptionId?: string;
      from?: string;
      to?: string;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyInvoice(m, "finance.read"));
    const filters: SQL[] = [eq(invoices.organizationId, organizationId)];
    if (query.status)
      filters.push(eq(invoices.status, query.status as typeof invoices.$inferSelect.status));
    if (query.clientId) filters.push(eq(invoices.clientId, query.clientId));
    if (query.subscriptionId) filters.push(eq(invoices.subscriptionId, query.subscriptionId));

    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.invoices.findMany({
        where,
        orderBy: [desc(invoices.createdAt)],
        limit: query.limit,
        offset: query.offset,
        with: { lines: true },
      }),
      this.db.select({ value: count() }).from(invoices).where(where),
    ]);
    return {
      items: items.map((row) => ({
        ...serializeInvoice(row),
        lines: row.lines,
      })),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createInvoice(
    account: SessionAccount,
    organizationId: string,
    input: {
      userId?: string;
      clientId?: string;
      subscriptionId?: string;
      invoiceNumber?: string;
      currency: string;
      subtotalCents: number;
      discountCents: number;
      taxCents: number;
      estimatedTaxCents?: number | null;
      taxSource?: string;
      totalCents?: number;
      amountDueCents?: number;
      status: "draft" | "open";
      issuedAt?: string;
      dueAt?: string;
      externalReference?: string;
      periodKey?: string;
      metadata?: Record<string, unknown>;
      lines?: Array<{
        type: (typeof invoiceLines.$inferInsert)["type"];
        description: string;
        quantity: number;
        unitAmountCents: number;
        totalAmountCents: number;
        referenceType?: string;
        referenceId?: string;
        metadata?: Record<string, unknown>;
      }>;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyInvoice(m, "finance.invoice.create"));

    const lineSubtotal =
      input.lines?.reduce((sum, line) => sum + line.totalAmountCents, 0) ?? input.subtotalCents;
    const subtotalCents = input.lines?.length ? lineSubtotal : input.subtotalCents;
    const totals = computeInvoiceTotals({
      subtotalCents,
      discountCents: input.discountCents,
      taxCents: input.taxCents,
    });
    const invoiceNumber =
      input.invoiceNumber ??
      `INV-${organizationId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    try {
      const [invoice] = await this.db
        .insert(invoices)
        .values({
          organizationId,
          userId: input.userId ?? null,
          clientId: input.clientId ?? null,
          subscriptionId: input.subscriptionId ?? null,
          invoiceNumber,
          currency: input.currency,
          subtotalCents,
          discountCents: input.discountCents,
          taxCents: input.taxCents,
          estimatedTaxCents: input.estimatedTaxCents ?? null,
          taxSource: input.taxSource ?? null,
          // Com linhas, totais derivados das linhas prevalecem sobre default 0 do schema.
          totalCents: input.lines?.length
            ? totals.totalCents
            : input.totalCents || totals.totalCents,
          amountPaidCents: 0,
          amountDueCents: input.lines?.length
            ? totals.amountDueCents
            : input.amountDueCents || totals.amountDueCents,
          status: input.status,
          issuedAt:
            input.status === "open"
              ? (parseDate(input.issuedAt) ?? new Date())
              : (parseDate(input.issuedAt) ?? null),
          dueAt: parseDate(input.dueAt) ?? null,
          externalReference: input.externalReference ?? null,
          periodKey: input.periodKey ?? null,
          metadata: input.metadata ?? null,
        })
        .returning();

      if (input.lines?.length) {
        await this.db.insert(invoiceLines).values(
          input.lines.map((line) => ({
            invoiceId: invoice!.id,
            type: line.type,
            description: line.description,
            quantity: line.quantity,
            unitAmountCents: line.unitAmountCents,
            totalAmountCents: line.totalAmountCents,
            referenceType: line.referenceType ?? null,
            referenceId: line.referenceId ?? null,
            metadata: line.metadata ?? null,
          })),
        );
      }

      if (input.status === "open") {
        await this.ledger.ensureSystemAccounts(organizationId, invoice!.currency);
        if (invoice!.totalCents > 0) {
          const receivable = await this.ledger.getSystemAccount(
            organizationId,
            "PAYMENT_RECEIVABLE",
            invoice!.currency,
          );
          const revenue = await this.ledger.getSystemAccount(
            organizationId,
            "PLATFORM_REVENUE",
            invoice!.currency,
          );
          await this.ledger.post({
            organizationId,
            transactionType: "invoice_recognition",
            referenceType: "invoice",
            referenceId: invoice!.id,
            currency: invoice!.currency,
            idempotencyKey: `invoice_issue:${invoice!.id}`,
            description: `Emissão fatura ${invoice!.invoiceNumber}`,
            entries: [
              { accountId: receivable.id, direction: "debit", amountCents: invoice!.totalCents },
              { accountId: revenue.id, direction: "credit", amountCents: invoice!.totalCents },
            ],
          });
        }
        await auditBilling(
          this.db,
          account,
          organizationId,
          "billing.invoice_issued",
          "invoice",
          invoice!.id,
          meta,
          { totalCents: invoice!.totalCents },
        );
      }

      const full = await this.db.query.invoices.findFirst({
        where: eq(invoices.id, invoice!.id),
        with: { lines: true },
      });
      return { invoice: { ...serializeInvoice(full!), lines: full!.lines } };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Número de fatura ou período já utilizado.");
      }
      throw error;
    }
  }

  async addInvoiceLine(
    account: SessionAccount,
    organizationId: string,
    invoiceId: string,
    input: {
      type: (typeof invoiceLines.$inferInsert)["type"];
      description: string;
      quantity: number;
      unitAmountCents: number;
      totalAmountCents: number;
      referenceType?: string;
      referenceId?: string;
      metadata?: Record<string, unknown>;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyInvoice(m, "finance.invoice.update"));
    const invoice = await this.requireInvoice(organizationId, invoiceId);
    if (invoice.status !== "draft") {
      throw new AppError("CONFLICT", "Somente faturas em rascunho aceitam novas linhas.");
    }

    const [line] = await this.db
      .insert(invoiceLines)
      .values({
        invoiceId,
        type: input.type,
        description: input.description,
        quantity: input.quantity,
        unitAmountCents: input.unitAmountCents,
        totalAmountCents: input.totalAmountCents,
        referenceType: input.referenceType ?? null,
        referenceId: input.referenceId ?? null,
        metadata: input.metadata ?? null,
      })
      .returning();

    const subtotalCents = invoice.subtotalCents + input.totalAmountCents;
    const totals = computeInvoiceTotals({
      subtotalCents,
      discountCents: invoice.discountCents,
      taxCents: invoice.taxCents,
      amountPaidCents: invoice.amountPaidCents,
    });
    await this.db
      .update(invoices)
      .set({
        subtotalCents,
        totalCents: totals.totalCents,
        amountDueCents: totals.amountDueCents,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoiceId));

    await auditBilling(
      this.db,
      account,
      organizationId,
      "billing.invoice_issued",
      "invoice_line",
      line!.id,
      meta,
      { invoiceId },
    );
    return { line };
  }

  async issueInvoice(
    account: SessionAccount,
    organizationId: string,
    invoiceId: string,
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyInvoice(m, "finance.invoice.update"));
    const invoice = await this.requireInvoice(organizationId, invoiceId);
    if (invoice.status !== "draft") {
      throw new AppError("CONFLICT", "Somente faturas em rascunho podem ser emitidas.");
    }
    const [row] = await this.db
      .update(invoices)
      .set({ status: "open", issuedAt: new Date(), updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId))
      .returning();

    await this.ledger.ensureSystemAccounts(organizationId, invoice.currency);
    if (invoice.totalCents > 0) {
      const receivable = await this.ledger.getSystemAccount(
        organizationId,
        "PAYMENT_RECEIVABLE",
        invoice.currency,
      );
      const revenue = await this.ledger.getSystemAccount(
        organizationId,
        "PLATFORM_REVENUE",
        invoice.currency,
      );
      await this.ledger.post({
        organizationId,
        transactionType: "invoice_recognition",
        referenceType: "invoice",
        referenceId: invoiceId,
        currency: invoice.currency,
        idempotencyKey: `invoice_issue:${invoiceId}`,
        description: `Emissão fatura ${invoice.invoiceNumber}`,
        entries: [
          { accountId: receivable.id, direction: "debit", amountCents: invoice.totalCents },
          { accountId: revenue.id, direction: "credit", amountCents: invoice.totalCents },
        ],
      });
    }

    await auditBilling(
      this.db,
      account,
      organizationId,
      "billing.invoice_issued",
      "invoice",
      invoiceId,
      meta,
      { totalCents: row!.totalCents },
    );
    return { invoice: serializeInvoice(row!) };
  }

  async voidInvoice(
    account: SessionAccount,
    organizationId: string,
    invoiceId: string,
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyInvoice(m, "finance.invoice.update"));
    const invoice = await this.requireInvoice(organizationId, invoiceId);
    if (invoice.status === "paid" || invoice.status === "void") {
      throw new AppError("CONFLICT", "Esta fatura não pode ser anulada.");
    }
    const [row] = await this.db
      .update(invoices)
      .set({ status: "void", updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId))
      .returning();

    await auditBilling(
      this.db,
      account,
      organizationId,
      "billing.invoice_voided",
      "invoice",
      invoiceId,
      meta,
    );
    return { invoice: serializeInvoice(row!) };
  }

  async applyPaymentToInvoice(organizationId: string, invoiceId: string, amountCents: number) {
    const invoice = await this.requireInvoice(organizationId, invoiceId);
    const amountPaidCents = invoice.amountPaidCents + amountCents;
    const amountDueCents = Math.max(0, invoice.totalCents - amountPaidCents);
    let status: typeof invoices.$inferSelect.status = invoice.status;
    let paidAt = invoice.paidAt;
    if (amountDueCents === 0) {
      status = "paid";
      paidAt = new Date();
    } else if (amountPaidCents > 0) {
      status = "partially_paid";
    }
    const [row] = await this.db
      .update(invoices)
      .set({ amountPaidCents, amountDueCents, status, paidAt, updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId))
      .returning();
    return row!;
  }

  /* ─── Credits ─── */

  async listCredits(
    account: SessionAccount,
    organizationId: string,
    query: { status?: string; userId?: string; limit: number; offset: number },
  ) {
    authorize(account, organizationId, (m) => policyFinanceRead(m, "finance.read"));
    const filters: SQL[] = [eq(billingCredits.organizationId, organizationId)];
    if (query.status) {
      filters.push(
        eq(billingCredits.status, query.status as typeof billingCredits.$inferSelect.status),
      );
    }
    if (query.userId) filters.push(eq(billingCredits.userId, query.userId));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.billingCredits.findMany({
        where,
        orderBy: [desc(billingCredits.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(billingCredits).where(where),
    ]);
    return {
      items,
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createCredit(
    account: SessionAccount,
    organizationId: string,
    input: {
      userId?: string;
      amountCents: number;
      currency: string;
      reason: string;
      source: string;
      expiresAt?: string;
    },
    meta: RequestMeta,
  ) {
    const membership = authorize(account, organizationId, (m) =>
      policyFinanceManage(m, "finance.credit.manage"),
    );
    const [credit] = await this.db
      .insert(billingCredits)
      .values({
        organizationId,
        userId: input.userId ?? null,
        amountCents: input.amountCents,
        remainingCents: input.amountCents,
        currency: input.currency,
        reason: input.reason,
        source: input.source,
        status: "available",
        expiresAt: parseDate(input.expiresAt) ?? null,
        createdByMembershipId: membership.membershipId,
      })
      .returning();

    await this.ledger.ensureSystemAccounts(organizationId, input.currency);
    const liability = await this.ledger.getSystemAccount(
      organizationId,
      "CUSTOMER_CREDIT_LIABILITY",
      input.currency,
    );
    const revenue = await this.ledger.getSystemAccount(
      organizationId,
      "PLATFORM_REVENUE",
      input.currency,
    );
    const posted = await this.ledger.post({
      organizationId,
      transactionType: "credit_applied",
      referenceType: "billing_credit",
      referenceId: credit!.id,
      currency: input.currency,
      idempotencyKey: `billing_credit:${credit!.id}`,
      description: input.reason,
      createdByMembershipId: membership.membershipId,
      entries: [
        { accountId: revenue.id, direction: "debit", amountCents: input.amountCents },
        { accountId: liability.id, direction: "credit", amountCents: input.amountCents },
      ],
    });
    await this.db
      .update(billingCredits)
      .set({ ledgerTransactionId: posted.id, updatedAt: new Date() })
      .where(eq(billingCredits.id, credit!.id));

    await auditBilling(
      this.db,
      account,
      organizationId,
      "billing.credit_created",
      "billing_credit",
      credit!.id,
      meta,
      { amountCents: input.amountCents },
    );
    return { credit };
  }

  /* ─── Honorários ─── */

  async listHonorarios(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: string;
      clientId?: string;
      legalMatterId?: string;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyFinanceRead(m, "finance.read"));
    const filters: SQL[] = [eq(legalFeeAgreements.organizationId, organizationId)];
    if (query.status) {
      filters.push(
        eq(
          legalFeeAgreements.status,
          query.status as typeof legalFeeAgreements.$inferSelect.status,
        ),
      );
    }
    if (query.clientId) filters.push(eq(legalFeeAgreements.clientId, query.clientId));
    if (query.legalMatterId)
      filters.push(eq(legalFeeAgreements.legalMatterId, query.legalMatterId));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.legalFeeAgreements.findMany({
        where,
        orderBy: [desc(legalFeeAgreements.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(legalFeeAgreements).where(where),
    ]);
    return {
      items,
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createHonorario(
    account: SessionAccount,
    organizationId: string,
    input: {
      clientId?: string;
      legalMatterId?: string;
      contractId?: string;
      feeType: (typeof legalFeeAgreements.$inferInsert)["feeType"];
      fixedAmountCents?: number | null;
      hourlyRateCents?: number | null;
      percentageBps?: number | null;
      successFeeBps?: number | null;
      currency: string;
      installmentConfig?: Record<string, unknown>;
      status: "draft" | "active";
      notes?: string;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyFinanceManage(m, "finance.fee.manage"));
    const [row] = await this.db
      .insert(legalFeeAgreements)
      .values({
        organizationId,
        clientId: input.clientId ?? null,
        legalMatterId: input.legalMatterId ?? null,
        contractId: input.contractId ?? null,
        feeType: input.feeType,
        fixedAmountCents: input.fixedAmountCents ?? null,
        hourlyRateCents: input.hourlyRateCents ?? null,
        percentageBps: input.percentageBps ?? null,
        successFeeBps: input.successFeeBps ?? null,
        currency: input.currency,
        installmentConfig: input.installmentConfig ?? null,
        status: input.status,
        notes: input.notes ?? null,
      })
      .returning();

    await auditBilling(
      this.db,
      account,
      organizationId,
      "billing.fee_created",
      "legal_fee_agreement",
      row!.id,
      meta,
      { feeType: input.feeType },
    );
    return { agreement: row };
  }

  async createFeeAccrual(
    account: SessionAccount,
    organizationId: string,
    input: {
      agreementId: string;
      amountCents: number;
      currency: string;
      description?: string;
      status?: (typeof legalFeeAccruals.$inferInsert)["status"];
      accruedAt?: string;
      invoiceId?: string;
    },
    meta: RequestMeta,
  ) {
    const membership = authorize(account, organizationId, (m) =>
      policyFinanceManage(m, "finance.fee.manage"),
    );
    const agreement = await this.db.query.legalFeeAgreements.findFirst({
      where: and(
        eq(legalFeeAgreements.id, input.agreementId),
        eq(legalFeeAgreements.organizationId, organizationId),
      ),
    });
    if (!agreement) throw new AppError("NOT_FOUND", "Não encontramos este acordo de honorários.");

    const [accrual] = await this.db
      .insert(legalFeeAccruals)
      .values({
        agreementId: input.agreementId,
        organizationId,
        amountCents: input.amountCents,
        currency: input.currency,
        description: input.description ?? null,
        status: input.status ?? "accrued",
        accruedAt: parseDate(input.accruedAt) ?? new Date(),
        invoiceId: input.invoiceId ?? null,
      })
      .returning();

    await this.ledger.ensureSystemAccounts(organizationId, input.currency);
    const receivable = await this.ledger.getSystemAccount(
      organizationId,
      "PAYMENT_RECEIVABLE",
      input.currency,
    );
    const payable = await this.ledger.getSystemAccount(
      organizationId,
      "PROFESSIONAL_PAYABLE",
      input.currency,
    );
    const posted = await this.ledger.post({
      organizationId,
      transactionType: "fee_accrual",
      referenceType: "legal_fee_accrual",
      referenceId: accrual!.id,
      currency: input.currency,
      idempotencyKey: `fee_accrual:${accrual!.id}`,
      description: input.description ?? "Accrual de honorários",
      createdByMembershipId: membership.membershipId,
      entries: [
        { accountId: receivable.id, direction: "debit", amountCents: input.amountCents },
        { accountId: payable.id, direction: "credit", amountCents: input.amountCents },
      ],
    });
    await this.db
      .update(legalFeeAccruals)
      .set({ ledgerTransactionId: posted.id, updatedAt: new Date() })
      .where(eq(legalFeeAccruals.id, accrual!.id));

    await auditBilling(
      this.db,
      account,
      organizationId,
      "billing.fee_created",
      "legal_fee_accrual",
      accrual!.id,
      meta,
      { amountCents: input.amountCents },
    );
    return { accrual };
  }

  async listFeeAccruals(account: SessionAccount, organizationId: string, agreementId: string) {
    authorize(account, organizationId, (m) => policyFinanceRead(m, "finance.read"));
    const items = await this.db.query.legalFeeAccruals.findMany({
      where: and(
        eq(legalFeeAccruals.organizationId, organizationId),
        eq(legalFeeAccruals.agreementId, agreementId),
      ),
      orderBy: [desc(legalFeeAccruals.accruedAt)],
    });
    return { items };
  }

  /* ─── Costs ─── */

  async listCosts(
    account: SessionAccount,
    organizationId: string,
    query: {
      category?: string;
      legalMatterId?: string;
      from?: string;
      to?: string;
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyFinanceRead(m, "finance.read"));
    const filters: SQL[] = [eq(costRecords.organizationId, organizationId)];
    if (query.category) {
      filters.push(
        eq(costRecords.category, query.category as typeof costRecords.$inferSelect.category),
      );
    }
    if (query.legalMatterId) filters.push(eq(costRecords.legalMatterId, query.legalMatterId));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.costRecords.findMany({
        where,
        orderBy: [desc(costRecords.incurredAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(costRecords).where(where),
    ]);
    return {
      items,
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async createCost(
    account: SessionAccount,
    organizationId: string,
    input: {
      category: (typeof costRecords.$inferInsert)["category"];
      description: string;
      amountCents: number;
      currency: string;
      incurredAt?: string;
      legalMatterId?: string;
      serviceReferenceType?: string;
      serviceReferenceId?: string;
      documentId?: string;
      source: string;
    },
    meta: RequestMeta,
  ) {
    const membership = authorize(account, organizationId, (m) =>
      policyFinanceManage(m, "finance.cost.manage"),
    );
    const [cost] = await this.db
      .insert(costRecords)
      .values({
        organizationId,
        category: input.category,
        description: input.description,
        amountCents: input.amountCents,
        currency: input.currency,
        incurredAt: parseDate(input.incurredAt) ?? new Date(),
        legalMatterId: input.legalMatterId ?? null,
        serviceReferenceType: input.serviceReferenceType ?? null,
        serviceReferenceId: input.serviceReferenceId ?? null,
        documentId: input.documentId ?? null,
        source: input.source,
        createdByMembershipId: membership.membershipId,
      })
      .returning();

    await this.ledger.ensureSystemAccounts(organizationId, input.currency);
    const expense = await this.ledger.getSystemAccount(
      organizationId,
      "PROCESSING_FEE_EXPENSE",
      input.currency,
    );
    const cash = await this.ledger.getSystemAccount(
      organizationId,
      "CASH_CLEARING",
      input.currency,
    );
    const posted = await this.ledger.post({
      organizationId,
      transactionType: "cost",
      referenceType: "cost_record",
      referenceId: cost!.id,
      currency: input.currency,
      idempotencyKey: `cost:${cost!.id}`,
      description: input.description,
      createdByMembershipId: membership.membershipId,
      entries: [
        { accountId: expense.id, direction: "debit", amountCents: input.amountCents },
        { accountId: cash.id, direction: "credit", amountCents: input.amountCents },
      ],
    });
    await this.db
      .update(costRecords)
      .set({ ledgerTransactionId: posted.id, updatedAt: new Date() })
      .where(eq(costRecords.id, cost!.id));

    await auditBilling(
      this.db,
      account,
      organizationId,
      "billing.cost_recorded",
      "cost_record",
      cost!.id,
      meta,
      { amountCents: input.amountCents, category: input.category },
    );
    return { cost };
  }

  /* ─── Platform fees ─── */

  async listPlatformFeeRules(account: SessionAccount, organizationId: string) {
    authorize(account, organizationId, (m) => policyFinanceRead(m, "finance.read"));
    const items = await this.db.query.platformFeeRules.findMany({
      where: eq(platformFeeRules.active, true),
      orderBy: [asc(platformFeeRules.key), desc(platformFeeRules.version)],
    });
    return { items };
  }

  /* ─── Dashboard ─── */

  async dashboardSummary(account: SessionAccount, organizationId: string) {
    authorize(account, organizationId, (m) => policyFinanceRead(m, "finance.read"));
    await this.ledger.ensureSystemAccounts(organizationId);

    const [invoiceSummary, ar, cash, creditsAgg, costsAgg, provider] = await Promise.all([
      this.ar.summaryByStatus(organizationId),
      this.ar.project(organizationId),
      this.balances.cashClearingBalance(organizationId),
      this.db
        .select({
          availableCents: sql<string>`coalesce(sum(case when ${billingCredits.status} = 'available' then ${billingCredits.remainingCents} else 0 end), 0)::text`,
        })
        .from(billingCredits)
        .where(eq(billingCredits.organizationId, organizationId)),
      this.db
        .select({
          totalCents: sql<string>`coalesce(sum(${costRecords.amountCents}), 0)::text`,
        })
        .from(costRecords)
        .where(eq(costRecords.organizationId, organizationId)),
      this.paymentProvider?.healthCheck() ??
        Promise.resolve({
          status: "not_configured" as const,
          detail: "Provedor não injetado.",
          checkedAt: new Date().toISOString(),
        }),
    ]);

    const byStatus = Object.fromEntries(invoiceSummary.map((row) => [row.status, row])) as Record<
      string,
      (typeof invoiceSummary)[number]
    >;

    return {
      invoices: {
        open: byStatus.open ?? { status: "open", count: 0, totalDueCents: 0, totalPaidCents: 0 },
        past_due: byStatus.past_due ?? {
          status: "past_due",
          count: 0,
          totalDueCents: 0,
          totalPaidCents: 0,
        },
        paid: byStatus.paid ?? { status: "paid", count: 0, totalDueCents: 0, totalPaidCents: 0 },
        all: invoiceSummary,
      },
      accountsReceivable: ar,
      costs: { totalCents: Number(costsAgg[0]?.totalCents ?? 0) },
      credits: { availableCents: Number(creditsAgg[0]?.availableCents ?? 0) },
      ledger: { cashClearingBalanceCents: cash.balanceCents, currency: cash.currency },
      providerStatus: provider,
    };
  }

  private async requireInvoice(organizationId: string, invoiceId: string) {
    const row = await this.db.query.invoices.findFirst({
      where: and(eq(invoices.id, invoiceId), eq(invoices.organizationId, organizationId)),
    });
    if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta fatura.");
    return row;
  }
}
