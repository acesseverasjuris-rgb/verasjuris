import { recordAudit } from "@verasjuris/audit";
import {
  policyApiClient,
  policyLicense,
  policyMonetization,
  policyWhiteLabel,
  type SessionAccount,
} from "@verasjuris/auth";
import type { CustomDomainProvider } from "@verasjuris/ai";
import {
  aiCreditTransactions,
  aiCreditWallets,
  apiClientScopes,
  apiClients,
  apiCredentials,
  apiScopes,
  apiUsageRecords,
  billingPlanVersions,
  invoiceLines,
  invoices,
  isUniqueViolation,
  monetizationProducts,
  productPrices,
  softwareLicenses,
  subscriptions,
  technologyFeeRules,
  usageMeters,
  usageRecords,
  whiteLabelConfigs,
  type AppDatabase,
} from "@verasjuris/database";
import { hashPassword } from "@verasjuris/security";
import { AppError } from "@verasjuris/types";
import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";

const DEFAULT_PLAN_TIERS = [
  {
    key: "plan_individual",
    name: "Individual",
    planTier: "individual" as const,
    planTarget: "user" as const,
    amountCents: 0,
  },
  {
    key: "plan_professional",
    name: "Profissional",
    planTier: "professional" as const,
    planTarget: "professional" as const,
    amountCents: 9900,
  },
  {
    key: "plan_office",
    name: "Escritório",
    planTier: "office" as const,
    planTarget: "organization" as const,
    amountCents: 29900,
  },
  {
    key: "plan_business",
    name: "Empresarial",
    planTier: "business" as const,
    planTarget: "organization" as const,
    amountCents: 79900,
  },
  {
    key: "plan_enterprise",
    name: "Enterprise",
    planTier: "enterprise" as const,
    planTarget: "enterprise" as const,
    amountCents: 0,
  },
  {
    key: "plan_white_label",
    name: "White-label",
    planTier: "white_label" as const,
    planTarget: "partner" as const,
    amountCents: 0,
  },
] as const;

/**
 * Monetização configurável: produtos/preços versionados, usage, AI credits,
 * API clients, licenses, white-label (branding only).
 * Nunca espalhar `if plan === PRO` — limites passam por EntitlementService.
 */
export class MonetizationService {
  constructor(
    private readonly db: AppDatabase,
    private readonly customDomainProvider?: CustomDomainProvider,
  ) {}

  /* ─── Seed configurable plan tier products ─── */

  async ensureDefaultPlanProducts(organizationId?: string | null) {
    const existing = await this.db.query.monetizationProducts.findMany({
      where: eq(monetizationProducts.productType, "subscription"),
      limit: 1,
    });
    if (existing.length > 0) return { seeded: false, count: 0 };

    let seeded = 0;
    for (const tier of DEFAULT_PLAN_TIERS) {
      const [product] = await this.db
        .insert(monetizationProducts)
        .values({
          organizationId: organizationId ?? null,
          key: tier.key,
          name: tier.name,
          description: `Plano configurável ${tier.name} (seed). Preços/limites editáveis — não hardcode de features.`,
          productType: "subscription",
          planTier: tier.planTier,
          planTarget: tier.planTarget,
          active: true,
          public: true,
        })
        .onConflictDoNothing()
        .returning();
      if (!product) continue;
      await this.db.insert(productPrices).values({
        productId: product.id,
        amountCents: tier.amountCents,
        currency: "BRL",
        interval: "monthly",
        usageBased: false,
        active: true,
        version: 1,
      });
      seeded += 1;
    }
    return { seeded: true, count: seeded };
  }

  /* ─── Products / prices ─── */

  async listProducts(
    account: SessionAccount | null,
    organizationId: string | null,
    query: {
      productType?: (typeof monetizationProducts.$inferSelect)["productType"];
      active?: boolean;
      public?: boolean;
      limit: number;
      offset: number;
    },
  ) {
    if (account && organizationId) {
      authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
    }
    await this.ensureDefaultPlanProducts(organizationId);

    const filters: SQL[] = [];
    if (organizationId) {
      filters.push(
        sql`(${monetizationProducts.organizationId} = ${organizationId} or ${monetizationProducts.organizationId} is null)`,
      );
    } else if (query.public !== false) {
      filters.push(eq(monetizationProducts.public, true));
    }
    if (query.productType) filters.push(eq(monetizationProducts.productType, query.productType));
    if (query.active !== undefined) filters.push(eq(monetizationProducts.active, query.active));
    if (query.public !== undefined) filters.push(eq(monetizationProducts.public, query.public));

    const where = filters.length ? and(...filters) : undefined;
    const [items, totalRow] = await Promise.all([
      this.db.query.monetizationProducts.findMany({
        where,
        orderBy: [asc(monetizationProducts.planTier), desc(monetizationProducts.createdAt)],
        limit: query.limit,
        offset: query.offset,
        with: { prices: true },
      }),
      this.db.select({ value: count() }).from(monetizationProducts).where(where),
    ]);

    return {
      items: items.map((p) => serializeProduct(p, p.prices ?? [])),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * Public / authenticated plan comparison — lists public products only.
   * Does not invent feature matrices; returns catalog fields as stored.
   */
  async listPublicPlans(query: { limit?: number; offset?: number } = {}) {
    await this.ensureDefaultPlanProducts(null);
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;
    const where = and(
      eq(monetizationProducts.public, true),
      eq(monetizationProducts.active, true),
      eq(monetizationProducts.productType, "subscription"),
    );
    const items = await this.db.query.monetizationProducts.findMany({
      where,
      orderBy: [asc(monetizationProducts.planTier)],
      limit,
      offset,
      with: { prices: true },
    });
    return {
      items: items.map((p) => {
        const activePrices = (p.prices ?? []).filter((price) => price.active);
        return {
          id: p.id,
          key: p.key,
          name: p.name,
          description: p.description,
          planTier: p.planTier,
          planTarget: p.planTarget,
          prices: activePrices.map(serializePrice),
          /** Features come from billing_plan_features via EntitlementService — not invented here. */
          features: null as null,
          featureSource: "entitlement_service" as const,
        };
      }),
      total: items.length,
      limit,
      offset,
    };
  }

  async createProduct(
    account: SessionAccount,
    organizationId: string,
    input: {
      key: string;
      name: string;
      description?: string;
      productType: (typeof monetizationProducts.$inferInsert)["productType"];
      planTier?: (typeof monetizationProducts.$inferInsert)["planTier"];
      planTarget?: (typeof monetizationProducts.$inferInsert)["planTarget"];
      billingPlanId?: string;
      active?: boolean;
      public?: boolean;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyMonetization(m, "monetization.product.manage"));
    try {
      const [row] = await this.db
        .insert(monetizationProducts)
        .values({
          organizationId,
          key: input.key,
          name: input.name,
          description: input.description ?? null,
          productType: input.productType,
          planTier: input.planTier ?? null,
          planTarget: input.planTarget ?? null,
          billingPlanId: input.billingPlanId ?? null,
          active: input.active ?? true,
          public: input.public ?? false,
        })
        .returning();

      await recordAudit(this.db, {
        actorUserId: account.user.id,
        organizationId,
        action: "monetization.product_created",
        resourceType: "monetization_product",
        resourceId: row!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { key: row!.key, productType: row!.productType },
      });
      return { product: serializeProduct(row!, []) };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Já existe um produto com esta chave.");
      }
      throw error;
    }
  }

  async createPrice(
    account: SessionAccount,
    organizationId: string,
    input: {
      productId: string;
      amountCents: number;
      currency: string;
      interval?: string;
      usageBased?: boolean;
      validFrom?: string;
      validTo?: string;
      active?: boolean;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyMonetization(m, "monetization.pricing.manage"));
    const product = await this.requireProduct(organizationId, input.productId);
    const last = await this.db.query.productPrices.findFirst({
      where: eq(productPrices.productId, product.id),
      orderBy: [desc(productPrices.version)],
    });
    const version = (last?.version ?? 0) + 1;
    const [row] = await this.db
      .insert(productPrices)
      .values({
        productId: product.id,
        amountCents: input.amountCents,
        currency: input.currency,
        interval: input.interval ?? null,
        usageBased: input.usageBased ?? false,
        validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
        validTo: input.validTo ? new Date(input.validTo) : null,
        active: input.active ?? true,
        version,
      })
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "monetization.price_changed",
      resourceType: "product_price",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { productId: product.id, amountCents: row!.amountCents, version },
    });
    return { price: serializePrice(row!) };
  }

  /* ─── Usage meters / records ─── */

  async createMeter(
    account: SessionAccount,
    organizationId: string,
    input: {
      key: string;
      name: string;
      unit: string;
      aggregationType?: (typeof usageMeters.$inferInsert)["aggregationType"];
      resetPeriod?: (typeof usageMeters.$inferInsert)["resetPeriod"];
      billable?: boolean;
      active?: boolean;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyMonetization(m, "monetization.product.manage"));
    try {
      const [row] = await this.db
        .insert(usageMeters)
        .values({
          key: input.key,
          name: input.name,
          unit: input.unit,
          aggregationType: input.aggregationType ?? "sum",
          resetPeriod: input.resetPeriod ?? "monthly",
          billable: input.billable ?? true,
          active: input.active ?? true,
        })
        .returning();
      await recordAudit(this.db, {
        actorUserId: account.user.id,
        organizationId,
        action: "monetization.usage_meter_created",
        resourceType: "usage_meter",
        resourceId: row!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { key: row!.key },
      });
      return { meter: row };
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppError("CONFLICT", "Meter já existe.");
      throw error;
    }
  }

  async recordUsage(
    account: SessionAccount,
    organizationId: string,
    input: {
      meterId: string;
      quantity: number;
      occurredAt?: string;
      sourceType: string;
      sourceId?: string;
      userId?: string;
      idempotencyKey: string;
      metadata?: Record<string, unknown>;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
    const meter = await this.db.query.usageMeters.findFirst({
      where: eq(usageMeters.id, input.meterId),
    });
    if (!meter || !meter.active) throw new AppError("NOT_FOUND", "Meter não encontrado.");

    const existing = await this.db.query.usageRecords.findFirst({
      where: and(
        eq(usageRecords.organizationId, organizationId),
        eq(usageRecords.idempotencyKey, input.idempotencyKey),
      ),
    });
    if (existing) return { record: existing, alreadyExists: true };

    try {
      const [row] = await this.db
        .insert(usageRecords)
        .values({
          organizationId,
          userId: input.userId ?? null,
          meterId: input.meterId,
          quantity: input.quantity,
          occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
          sourceType: input.sourceType,
          sourceId: input.sourceId ?? null,
          idempotencyKey: input.idempotencyKey,
          metadata: input.metadata ?? null,
        })
        .returning();
      await recordAudit(this.db, {
        actorUserId: account.user.id,
        organizationId,
        action: "monetization.usage_recorded",
        resourceType: "usage_record",
        resourceId: row!.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { meterId: input.meterId, quantity: input.quantity },
      });
      return { record: row!, alreadyExists: false };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const again = await this.db.query.usageRecords.findFirst({
          where: and(
            eq(usageRecords.organizationId, organizationId),
            eq(usageRecords.idempotencyKey, input.idempotencyKey),
          ),
        });
        if (again) return { record: again, alreadyExists: true };
      }
      throw error;
    }
  }

  /* ─── AI credit wallets ───
   * amountCredits = commercial credits (NOT provider tokens).
   * providerTokens / providerCostMicros stored separately on the same transaction.
   */

  async getOrCreateWallet(
    account: SessionAccount,
    organizationId: string,
    input: { userId?: string; currencyLabel?: string } = {},
  ) {
    authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
    if (input.userId) {
      const existing = await this.db.query.aiCreditWallets.findFirst({
        where: eq(aiCreditWallets.userId, input.userId),
      });
      if (existing) return { wallet: serializeWallet(existing) };
      const [row] = await this.db
        .insert(aiCreditWallets)
        .values({
          userId: input.userId,
          organizationId: null,
          currencyLabel: input.currencyLabel ?? "credit",
          balanceCredits: 0,
        })
        .returning();
      return { wallet: serializeWallet(row!) };
    }

    const existing = await this.db.query.aiCreditWallets.findFirst({
      where: eq(aiCreditWallets.organizationId, organizationId),
    });
    if (existing) return { wallet: serializeWallet(existing) };
    const [row] = await this.db
      .insert(aiCreditWallets)
      .values({
        organizationId,
        userId: null,
        currencyLabel: input.currencyLabel ?? "credit",
        balanceCredits: 0,
      })
      .returning();
    return { wallet: serializeWallet(row!) };
  }

  async postAiCreditTransaction(
    account: SessionAccount,
    organizationId: string,
    input: {
      walletId: string;
      type: (typeof aiCreditTransactions.$inferInsert)["type"];
      amountCredits: number;
      reason?: string;
      sourceType?: string;
      sourceId?: string;
      providerTokens?: number;
      providerCostMicros?: number;
      featureKey?: string;
      idempotencyKey: string;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyMonetization(m, "monetization.plan.manage"));
    const wallet = await this.db.query.aiCreditWallets.findFirst({
      where: eq(aiCreditWallets.id, input.walletId),
    });
    if (!wallet) throw new AppError("NOT_FOUND", "Carteira de créditos não encontrada.");
    if (wallet.organizationId && wallet.organizationId !== organizationId) {
      throw new AppError("NOT_FOUND", "Carteira de créditos não encontrada.");
    }

    const existing = await this.db.query.aiCreditTransactions.findFirst({
      where: and(
        eq(aiCreditTransactions.walletId, wallet.id),
        eq(aiCreditTransactions.idempotencyKey, input.idempotencyKey),
      ),
    });
    if (existing) {
      return {
        transaction: serializeAiTx(existing),
        wallet: serializeWallet(wallet),
        alreadyExists: true,
      };
    }

    const delta = signedCreditDelta(input.type, input.amountCredits);
    const nextBalance = wallet.balanceCredits + delta;
    if (nextBalance < 0) {
      throw new AppError("VALIDATION_ERROR", "Saldo de créditos de IA insuficiente.", [
        { path: "amountCredits", message: "insufficient_ai_credit_balance" },
      ]);
    }

    const [tx] = await this.db
      .insert(aiCreditTransactions)
      .values({
        walletId: wallet.id,
        type: input.type,
        amountCredits: Math.abs(input.amountCredits),
        balanceAfterCredits: nextBalance,
        reason: input.reason ?? null,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        // Commercial credits ≠ provider tokens — both stored, never equated.
        providerTokens: input.providerTokens ?? null,
        providerCostMicros: input.providerCostMicros ?? null,
        featureKey: input.featureKey ?? null,
        idempotencyKey: input.idempotencyKey,
      })
      .returning();

    const [updatedWallet] = await this.db
      .update(aiCreditWallets)
      .set({ balanceCredits: nextBalance, updatedAt: new Date() })
      .where(eq(aiCreditWallets.id, wallet.id))
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: `monetization.ai_credit_${input.type}`,
      resourceType: "ai_credit_transaction",
      resourceId: tx!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        type: input.type,
        amountCredits: Math.abs(input.amountCredits),
        providerTokens: input.providerTokens ?? null,
        balanceAfterCredits: nextBalance,
      },
    });

    return {
      transaction: serializeAiTx(tx!),
      wallet: serializeWallet(updatedWallet!),
      alreadyExists: false,
    };
  }

  /* ─── Technology fee rules ─── */

  async createTechnologyFeeRule(
    account: SessionAccount,
    organizationId: string,
    input: {
      key: string;
      name: string;
      appliesTo: string;
      percentageBps?: number | null;
      fixedAmountCents?: number | null;
      currency: string;
      active?: boolean;
      validFrom?: string;
      validTo?: string;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyMonetization(m, "monetization.pricing.manage"));
    const last = await this.db.query.technologyFeeRules.findFirst({
      where: eq(technologyFeeRules.key, input.key),
      orderBy: [desc(technologyFeeRules.version)],
    });
    const [row] = await this.db
      .insert(technologyFeeRules)
      .values({
        key: input.key,
        name: input.name,
        appliesTo: input.appliesTo,
        percentageBps: input.percentageBps ?? null,
        fixedAmountCents: input.fixedAmountCents ?? null,
        currency: input.currency,
        version: (last?.version ?? 0) + 1,
        active: input.active ?? true,
        validFrom: input.validFrom ? new Date(input.validFrom) : new Date(),
        validTo: input.validTo ? new Date(input.validTo) : null,
      })
      .returning();
    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "monetization.technology_fee_rule_created",
      resourceType: "technology_fee_rule",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { key: row!.key, version: row!.version },
    });
    return { rule: row };
  }

  async listTechnologyFeeRules(account: SessionAccount, organizationId: string) {
    authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));
    const items = await this.db.query.technologyFeeRules.findMany({
      where: eq(technologyFeeRules.active, true),
      orderBy: [asc(technologyFeeRules.appliesTo), desc(technologyFeeRules.version)],
    });
    return { items };
  }

  /* ─── API clients / credentials / scopes / usage ─── */

  async createApiClient(
    account: SessionAccount,
    organizationId: string,
    input: {
      name: string;
      planId?: string;
      status?: (typeof apiClients.$inferInsert)["status"];
      scopeIds?: string[];
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyApiClient(m, "monetization.api.manage"));
    const [client] = await this.db
      .insert(apiClients)
      .values({
        organizationId,
        name: input.name,
        planId: input.planId ?? null,
        status: input.status ?? "active",
      })
      .returning();

    if (input.scopeIds?.length) {
      for (const scopeId of input.scopeIds) {
        await this.db
          .insert(apiClientScopes)
          .values({ apiClientId: client!.id, scopeId })
          .onConflictDoNothing();
      }
    }

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "monetization.api_client_created",
      resourceType: "api_client",
      resourceId: client!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { name: client!.name },
    });
    return { client: serializeApiClient(client!) };
  }

  async listApiClients(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: (typeof apiClients.$inferSelect)["status"];
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyApiClient(m, "monetization.read"));
    const filters: SQL[] = [eq(apiClients.organizationId, organizationId)];
    if (query.status) filters.push(eq(apiClients.status, query.status));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.apiClients.findMany({
        where,
        orderBy: [desc(apiClients.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(apiClients).where(where),
    ]);
    return {
      items: items.map(serializeApiClient),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  /**
   * Creates credential; returns plaintext secret ONCE.
   * Persists secretHash (scrypt via hashPassword) + prefix only.
   */
  async createApiCredential(
    account: SessionAccount,
    organizationId: string,
    apiClientId: string,
    input: { prefix?: string },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyApiClient(m, "monetization.api.manage"));
    const client = await this.requireApiClient(organizationId, apiClientId);
    const prefix = input.prefix ?? "vj_";
    const secret = `${prefix}${randomBytes(32).toString("base64url")}`;
    const credentialId = `cred_${randomBytes(12).toString("hex")}`;
    const secretHash = await hashPassword(secret);

    const [row] = await this.db
      .insert(apiCredentials)
      .values({
        apiClientId: client.id,
        credentialId,
        secretHash,
        prefix,
      })
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "monetization.api_credential_created",
      resourceType: "api_credential",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { credentialId, prefix, secretReturnedOnce: true },
    });

    return {
      credential: {
        id: row!.id,
        credentialId: row!.credentialId,
        prefix: row!.prefix,
        createdAt: row!.createdAt.toISOString(),
        revokedAt: null as string | null,
      },
      /** Plaintext secret — returned only on create; never stored. */
      secret,
      secretReturnedOnce: true as const,
    };
  }

  async revokeApiCredential(
    account: SessionAccount,
    organizationId: string,
    apiClientId: string,
    credentialId: string,
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyApiClient(m, "monetization.api.manage"));
    await this.requireApiClient(organizationId, apiClientId);
    const cred = await this.db.query.apiCredentials.findFirst({
      where: and(
        eq(apiCredentials.apiClientId, apiClientId),
        eq(apiCredentials.credentialId, credentialId),
      ),
    });
    if (!cred) throw new AppError("NOT_FOUND", "Credencial não encontrada.");
    const [row] = await this.db
      .update(apiCredentials)
      .set({ revokedAt: new Date() })
      .where(eq(apiCredentials.id, cred.id))
      .returning();
    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "monetization.api_credential_revoked",
      resourceType: "api_credential",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { credentialId },
    });
    return {
      credential: { id: row!.id, credentialId: row!.credentialId, revokedAt: iso(row!.revokedAt) },
    };
  }

  async ensureDefaultScopes() {
    const defaults = [
      { key: "read", name: "Leitura" },
      { key: "write", name: "Escrita" },
      { key: "finance.read", name: "Financeiro leitura" },
      { key: "matters.read", name: "Casos leitura" },
    ];
    for (const scope of defaults) {
      await this.db.insert(apiScopes).values(scope).onConflictDoNothing();
    }
  }

  async listScopes(account: SessionAccount, organizationId: string) {
    authorize(account, organizationId, (m) => policyApiClient(m, "monetization.read"));
    await this.ensureDefaultScopes();
    const items = await this.db.query.apiScopes.findMany({
      orderBy: [asc(apiScopes.key)],
    });
    return { items };
  }

  async recordApiUsage(
    account: SessionAccount,
    organizationId: string,
    apiClientId: string,
    input: {
      endpointKey: string;
      quantity?: number;
      units?: number;
      occurredAt?: string;
      status?: string;
      idempotencyKey: string;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyApiClient(m, "monetization.api.manage"));
    await this.requireApiClient(organizationId, apiClientId);
    const existing = await this.db.query.apiUsageRecords.findFirst({
      where: and(
        eq(apiUsageRecords.apiClientId, apiClientId),
        eq(apiUsageRecords.idempotencyKey, input.idempotencyKey),
      ),
    });
    if (existing) return { record: existing, alreadyExists: true };

    const [row] = await this.db
      .insert(apiUsageRecords)
      .values({
        apiClientId,
        organizationId,
        endpointKey: input.endpointKey,
        quantity: input.quantity ?? 1,
        units: input.units ?? null,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        status: input.status ?? "ok",
        idempotencyKey: input.idempotencyKey,
      })
      .returning();
    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "monetization.api_usage_recorded",
      resourceType: "api_usage_record",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { endpointKey: input.endpointKey, quantity: input.quantity ?? 1 },
    });
    return { record: row!, alreadyExists: false };
  }

  /**
   * Aggregate API usage into an invoice line helper (idempotent by periodKey).
   */
  async aggregateApiUsageToInvoiceLine(
    account: SessionAccount,
    organizationId: string,
    input: {
      apiClientId: string;
      invoiceId: string;
      periodStart: string;
      periodEnd: string;
      unitAmountCents: number;
      periodKey: string;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyApiClient(m, "monetization.api.manage"));
    await this.requireApiClient(organizationId, input.apiClientId);
    const invoice = await this.db.query.invoices.findFirst({
      where: and(eq(invoices.id, input.invoiceId), eq(invoices.organizationId, organizationId)),
    });
    if (!invoice) throw new AppError("NOT_FOUND", "Invoice não encontrada.");

    const idempotencyRef = `api_usage:${input.apiClientId}:${input.periodKey}`;
    const existingLine = await this.db.query.invoiceLines.findFirst({
      where: and(
        eq(invoiceLines.invoiceId, invoice.id),
        eq(invoiceLines.referenceType, "api_usage_aggregate"),
        eq(invoiceLines.referenceId, input.apiClientId),
      ),
    });
    if (
      existingLine &&
      existingLine.metadata &&
      (existingLine.metadata as { periodKey?: string }).periodKey === input.periodKey
    ) {
      return { line: existingLine, alreadyExists: true, idempotencyRef };
    }

    const [agg] = await this.db
      .select({
        qty: sql<string>`coalesce(sum(${apiUsageRecords.quantity}), 0)::text`,
      })
      .from(apiUsageRecords)
      .where(
        and(
          eq(apiUsageRecords.apiClientId, input.apiClientId),
          eq(apiUsageRecords.organizationId, organizationId),
          sql`${apiUsageRecords.occurredAt} >= ${new Date(input.periodStart)}`,
          sql`${apiUsageRecords.occurredAt} <= ${new Date(input.periodEnd)}`,
        ),
      );
    const quantity = Number(agg?.qty ?? 0);
    const totalAmountCents = quantity * input.unitAmountCents;

    const [line] = await this.db
      .insert(invoiceLines)
      .values({
        invoiceId: invoice.id,
        type: "other",
        description: `Uso de API (${input.periodKey})`,
        quantity: Math.max(1, quantity),
        unitAmountCents: input.unitAmountCents,
        totalAmountCents,
        referenceType: "api_usage_aggregate",
        referenceId: input.apiClientId,
        metadata: {
          periodKey: input.periodKey,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          idempotencyRef,
          quantity,
        },
      })
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "monetization.api_usage_invoiced",
      resourceType: "invoice_line",
      resourceId: line!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { quantity, totalAmountCents, periodKey: input.periodKey },
    });
    return { line: line!, alreadyExists: false, idempotencyRef };
  }

  /* ─── Software licenses ─── */

  async createLicense(
    account: SessionAccount,
    organizationId: string,
    input: {
      product: string;
      licenseType?: (typeof softwareLicenses.$inferInsert)["licenseType"];
      startsAt?: string;
      endsAt?: string;
      seats?: number | null;
      status?: (typeof softwareLicenses.$inferInsert)["status"];
      contractId?: string;
      subscriptionId?: string;
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyLicense(m, "monetization.license.manage"));
    const [row] = await this.db
      .insert(softwareLicenses)
      .values({
        organizationId,
        product: input.product,
        licenseType: input.licenseType ?? "subscription",
        startsAt: input.startsAt ? new Date(input.startsAt) : new Date(),
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
        seats: input.seats ?? null,
        status: input.status ?? "draft",
        contractId: input.contractId ?? null,
        subscriptionId: input.subscriptionId ?? null,
      })
      .returning();

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "monetization.license_created",
      resourceType: "software_license",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { product: row!.product, status: row!.status },
    });
    return { license: serializeLicense(row!) };
  }

  async listLicenses(
    account: SessionAccount,
    organizationId: string,
    query: {
      status?: (typeof softwareLicenses.$inferSelect)["status"];
      licenseType?: (typeof softwareLicenses.$inferSelect)["licenseType"];
      limit: number;
      offset: number;
    },
  ) {
    authorize(account, organizationId, (m) => policyLicense(m, "monetization.read"));
    const filters: SQL[] = [eq(softwareLicenses.organizationId, organizationId)];
    if (query.status) filters.push(eq(softwareLicenses.status, query.status));
    if (query.licenseType) filters.push(eq(softwareLicenses.licenseType, query.licenseType));
    const where = and(...filters);
    const [items, totalRow] = await Promise.all([
      this.db.query.softwareLicenses.findMany({
        where,
        orderBy: [desc(softwareLicenses.createdAt)],
        limit: query.limit,
        offset: query.offset,
      }),
      this.db.select({ value: count() }).from(softwareLicenses).where(where),
    ]);
    return {
      items: items.map(serializeLicense),
      total: Number(totalRow[0]?.value ?? 0),
      limit: query.limit,
      offset: query.offset,
    };
  }

  async updateLicense(
    account: SessionAccount,
    organizationId: string,
    licenseId: string,
    input: Partial<{
      status: (typeof softwareLicenses.$inferSelect)["status"];
      endsAt: string | null;
      seats: number | null;
    }>,
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) => policyLicense(m, "monetization.license.manage"));
    const existing = await this.db.query.softwareLicenses.findFirst({
      where: and(
        eq(softwareLicenses.id, licenseId),
        eq(softwareLicenses.organizationId, organizationId),
      ),
    });
    if (!existing) throw new AppError("NOT_FOUND", "Licença não encontrada.");
    const [row] = await this.db
      .update(softwareLicenses)
      .set({
        status: input.status ?? existing.status,
        endsAt:
          input.endsAt === undefined
            ? existing.endsAt
            : input.endsAt === null
              ? null
              : new Date(input.endsAt),
        seats: input.seats === undefined ? existing.seats : input.seats,
        updatedAt: new Date(),
      })
      .where(eq(softwareLicenses.id, existing.id))
      .returning();
    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "monetization.license_updated",
      resourceType: "software_license",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: row!.status },
    });
    return { license: serializeLicense(row!) };
  }

  /* ─── White-label (branding only; never changes security/audit) ─── */

  async getWhiteLabel(account: SessionAccount, organizationId: string) {
    authorize(account, organizationId, (m) => policyWhiteLabel(m, "monetization.read"));
    const row = await this.db.query.whiteLabelConfigs.findFirst({
      where: eq(whiteLabelConfigs.organizationId, organizationId),
    });
    return {
      config: row ? serializeWhiteLabel(row) : null,
      securityUnchanged: true,
      auditUnchanged: true,
      customDomainProvider: this.customDomainProvider?.id ?? "not_configured",
    };
  }

  async upsertWhiteLabel(
    account: SessionAccount,
    organizationId: string,
    input: {
      enabled?: boolean;
      brandName?: string | null;
      logoDocumentId?: string | null;
      primaryColor?: string | null;
      secondaryColor?: string | null;
      customDomain?: string | null;
      supportBranding?: boolean;
      status?: (typeof whiteLabelConfigs.$inferInsert)["status"];
    },
    meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) =>
      policyWhiteLabel(m, "monetization.white_label.manage"),
    );

    let customDomainVerified = false;
    let customDomainProviderStatus: "ok" | "not_configured" = "not_configured";
    if (input.customDomain) {
      const provider = this.customDomainProvider;
      if (!provider || provider.id === "not_configured") {
        // Branding may still be saved; DNS attach remains NOT_CONFIGURED.
        customDomainProviderStatus = "not_configured";
        customDomainVerified = false;
      } else {
        customDomainProviderStatus = "ok";
        const ownership = await provider.verifyDomainOwnership({
          organizationId,
          domain: input.customDomain,
        });
        customDomainVerified = ownership.status === "verified";
      }
    }

    const existing = await this.db.query.whiteLabelConfigs.findFirst({
      where: eq(whiteLabelConfigs.organizationId, organizationId),
    });

    let row: typeof whiteLabelConfigs.$inferSelect;
    if (existing) {
      const [updated] = await this.db
        .update(whiteLabelConfigs)
        .set({
          enabled: input.enabled ?? existing.enabled,
          brandName: input.brandName === undefined ? existing.brandName : input.brandName,
          logoDocumentId:
            input.logoDocumentId === undefined ? existing.logoDocumentId : input.logoDocumentId,
          primaryColor:
            input.primaryColor === undefined ? existing.primaryColor : input.primaryColor,
          secondaryColor:
            input.secondaryColor === undefined ? existing.secondaryColor : input.secondaryColor,
          customDomain:
            input.customDomain === undefined ? existing.customDomain : input.customDomain,
          customDomainVerified:
            input.customDomain !== undefined ? customDomainVerified : existing.customDomainVerified,
          supportBranding: input.supportBranding ?? existing.supportBranding,
          status: input.status ?? existing.status,
          updatedAt: new Date(),
        })
        .where(eq(whiteLabelConfigs.id, existing.id))
        .returning();
      row = updated!;
    } else {
      const [created] = await this.db
        .insert(whiteLabelConfigs)
        .values({
          organizationId,
          enabled: input.enabled ?? false,
          brandName: input.brandName ?? null,
          logoDocumentId: input.logoDocumentId ?? null,
          primaryColor: input.primaryColor ?? null,
          secondaryColor: input.secondaryColor ?? null,
          customDomain: input.customDomain ?? null,
          customDomainVerified,
          supportBranding: input.supportBranding ?? true,
          status: input.status ?? "draft",
        })
        .returning();
      row = created!;
    }

    await recordAudit(this.db, {
      actorUserId: account.user.id,
      organizationId,
      action: "monetization.white_label_changed",
      resourceType: "white_label_config",
      resourceId: row!.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: {
        enabled: row!.enabled,
        brandName: row!.brandName,
        customDomain: row!.customDomain,
        securityUnchanged: true,
        auditUnchanged: true,
      },
    });

    return {
      config: serializeWhiteLabel(row!),
      securityUnchanged: true,
      auditUnchanged: true,
      customDomainProviderStatus:
        input.customDomain !== undefined ? customDomainProviderStatus : undefined,
      ...(input.customDomain && customDomainProviderStatus === "not_configured"
        ? {
            customDomainWarning: "CUSTOM_DOMAIN_PROVIDER_NOT_CONFIGURED" as const,
          }
        : {}),
    };
  }

  /**
   * Explicit DNS attach — always goes through CustomDomainProvider (NOT_CONFIGURED by default).
   */
  async attachCustomDomain(
    account: SessionAccount,
    organizationId: string,
    domain: string,
    _meta: RequestMeta,
  ) {
    authorize(account, organizationId, (m) =>
      policyWhiteLabel(m, "monetization.white_label.manage"),
    );
    const provider = this.customDomainProvider;
    if (!provider || provider.id === "not_configured") {
      throw new AppError(
        "CUSTOM_DOMAIN_PROVIDER_NOT_CONFIGURED",
        "Nenhum provedor de domínio customizado está configurado.",
      );
    }
    return provider.attachDomain({ organizationId, domain });
  }

  /* ─── Dashboard metrics (real DB data only) ─── */

  async dashboard(account: SessionAccount, organizationId: string) {
    authorize(account, organizationId, (m) => policyMonetization(m, "monetization.read"));

    const activeSubs = await this.db.query.subscriptions.findMany({
      where: and(
        eq(subscriptions.organizationId, organizationId),
        inArray(subscriptions.status, ["active", "trialing"]),
      ),
    });

    const planVersionIds = [...new Set(activeSubs.map((s) => s.planVersionId))];
    const versions =
      planVersionIds.length > 0
        ? await this.db.query.billingPlanVersions.findMany({
            where: inArray(billingPlanVersions.id, planVersionIds),
          })
        : [];
    const versionById = new Map(versions.map((v) => [v.id, v]));

    /**
     * MRR formula (documented):
     * Sum of recurring subscription list prices normalized to monthly minor units.
     * - monthly → priceCents
     * - quarterly → floor(priceCents / 3)
     * - yearly → floor(priceCents / 12)
     * - one_time / custom → EXCLUDED (never in MRR)
     * ARR run-rate = MRR * 12 (not trailing twelve months revenue).
     */
    let mrrCents = 0;
    for (const sub of activeSubs) {
      const version = versionById.get(sub.planVersionId);
      if (!version) continue;
      const interval = version.billingInterval;
      if (interval === "one_time" || interval === "custom") continue;
      if (interval === "yearly") mrrCents += Math.floor(version.priceCents / 12);
      else if (interval === "quarterly") mrrCents += Math.floor(version.priceCents / 3);
      else mrrCents += version.priceCents;
    }
    const arrRunRateCents = mrrCents * 12;

    const cancelled = await this.db
      .select({ value: count() })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.organizationId, organizationId),
          eq(subscriptions.status, "cancelled"),
        ),
      );
    const cancelledCount = Number(cancelled[0]?.value ?? 0);
    const totalKnown = activeSubs.length + cancelledCount;
    /**
     * Logo churn: cancelled / (active + cancelled) when sample exists.
     * Without a defined observation window / cohort, revenue churn = INSUFFICIENT_DATA.
     */
    const logoChurn =
      totalKnown > 0
        ? {
            rateBps: Math.floor((cancelledCount * 10_000) / totalKnown),
            cancelledCount,
            baseCount: totalKnown,
          }
        : { status: "INSUFFICIENT_DATA" as const };
    const revenueChurn = { status: "INSUFFICIENT_DATA" as const };

    const wallet = await this.db.query.aiCreditWallets.findFirst({
      where: eq(aiCreditWallets.organizationId, organizationId),
    });
    let aiCreditSales = 0;
    let aiCreditUsage = 0;
    if (wallet) {
      const txs = await this.db
        .select({
          type: aiCreditTransactions.type,
          total: sql<string>`coalesce(sum(${aiCreditTransactions.amountCredits}), 0)::text`,
        })
        .from(aiCreditTransactions)
        .where(eq(aiCreditTransactions.walletId, wallet.id))
        .groupBy(aiCreditTransactions.type);
      for (const row of txs) {
        const n = Number(row.total);
        if (row.type === "purchase" || row.type === "grant") aiCreditSales += n;
        if (row.type === "consumption") aiCreditUsage += n;
      }
    }

    const [apiUsage] = await this.db
      .select({
        total: sql<string>`coalesce(sum(${apiUsageRecords.quantity}), 0)::text`,
      })
      .from(apiUsageRecords)
      .where(eq(apiUsageRecords.organizationId, organizationId));

    return {
      mrrCents,
      /** ARR = MRR * 12 run-rate (not TTM). */
      arrRunRateCents,
      arrKind: "run_rate" as const,
      activeSubscriptions: activeSubs.length,
      churn: {
        logo: logoChurn,
        revenue: revenueChurn,
      },
      aiCredits: {
        balanceCredits: wallet?.balanceCredits ?? 0,
        salesCredits: aiCreditSales,
        usageCredits: aiCreditUsage,
        note: "Commercial credits; distinct from providerTokens on ai_credit_transactions.",
      },
      apiUsageTotal: Number(apiUsage?.total ?? 0),
      formulas: {
        mrr: "sum(monthly-normalized recurring subscription prices); excludes one_time/custom",
        arr: "mrrCents * 12 (run-rate)",
      },
    };
  }

  private async requireProduct(organizationId: string, productId: string) {
    const product = await this.db.query.monetizationProducts.findFirst({
      where: and(
        eq(monetizationProducts.id, productId),
        sql`(${monetizationProducts.organizationId} = ${organizationId} or ${monetizationProducts.organizationId} is null)`,
      ),
    });
    if (!product) throw new AppError("NOT_FOUND", "Produto não encontrado.");
    return product;
  }

  private async requireApiClient(organizationId: string, apiClientId: string) {
    const client = await this.db.query.apiClients.findFirst({
      where: and(eq(apiClients.id, apiClientId), eq(apiClients.organizationId, organizationId)),
    });
    if (!client) throw new AppError("NOT_FOUND", "API client não encontrado.");
    return client;
  }
}

function signedCreditDelta(
  type: (typeof aiCreditTransactions.$inferInsert)["type"],
  amount: number,
): number {
  const abs = Math.abs(amount);
  switch (type) {
    case "grant":
    case "purchase":
    case "refund":
      return abs;
    case "consumption":
    case "expiration":
      return -abs;
    case "adjustment":
      return amount;
    default:
      return amount;
  }
}

function serializeProduct(
  row: typeof monetizationProducts.$inferSelect,
  prices: (typeof productPrices.$inferSelect)[],
) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    key: row.key,
    name: row.name,
    description: row.description,
    productType: row.productType,
    planTier: row.planTier,
    planTarget: row.planTarget,
    billingPlanId: row.billingPlanId,
    active: row.active,
    public: row.public,
    prices: prices.map(serializePrice),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializePrice(row: typeof productPrices.$inferSelect) {
  return {
    id: row.id,
    productId: row.productId,
    amountCents: row.amountCents,
    currency: row.currency,
    interval: row.interval,
    usageBased: row.usageBased,
    validFrom: row.validFrom.toISOString(),
    validTo: iso(row.validTo),
    active: row.active,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeWallet(row: typeof aiCreditWallets.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    balanceCredits: row.balanceCredits,
    currencyLabel: row.currencyLabel,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeAiTx(row: typeof aiCreditTransactions.$inferSelect) {
  return {
    id: row.id,
    walletId: row.walletId,
    type: row.type,
    amountCredits: row.amountCredits,
    balanceAfterCredits: row.balanceAfterCredits,
    reason: row.reason,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    providerTokens: row.providerTokens,
    providerCostMicros: row.providerCostMicros,
    featureKey: row.featureKey,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
  };
}

function serializeApiClient(row: typeof apiClients.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    status: row.status,
    planId: row.planId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeLicense(row: typeof softwareLicenses.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    product: row.product,
    licenseType: row.licenseType,
    startsAt: row.startsAt.toISOString(),
    endsAt: iso(row.endsAt),
    seats: row.seats,
    status: row.status,
    contractId: row.contractId,
    subscriptionId: row.subscriptionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeWhiteLabel(row: typeof whiteLabelConfigs.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    enabled: row.enabled,
    brandName: row.brandName,
    logoDocumentId: row.logoDocumentId,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    customDomain: row.customDomain,
    customDomainVerified: row.customDomainVerified,
    supportBranding: row.supportBranding,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    brandingOnly: true as const,
  };
}
