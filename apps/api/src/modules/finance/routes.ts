import { policyFinanceRead } from "@verasjuris/auth";
import { AppError } from "@verasjuris/types";
import {
  addInvoiceLineSchema,
  cancelSubscriptionSchema,
  costRecordListQuerySchema,
  createBillingCreditSchema,
  createBillingPlanFeatureSchema,
  createBillingPlanSchema,
  createBillingPlanVersionSchema,
  createCheckoutSchema,
  createCostRecordSchema,
  createInvoiceSchema,
  createLedgerAccountSchema,
  createLedgerTransactionSchema,
  createLegalFeeAccrualSchema,
  createLegalFeeAgreementSchema,
  createPaymentIntentSchema,
  createReconciliationSchema,
  createRefundSchema,
  createSubscriptionSchema,
  creditListQuerySchema,
  invoiceListQuerySchema,
  ledgerAccountListQuerySchema,
  ledgerBalanceQuerySchema,
  ledgerTransactionListQuerySchema,
  legalFeeAgreementListQuerySchema,
  parseInput,
  paymentIntentListQuerySchema,
  paymentListQuerySchema,
  recordManualPaymentSchema,
  reconciliationListQuerySchema,
  reverseLedgerTransactionSchema,
  subscriptionListQuerySchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { Readable } from "node:stream";
import { z } from "zod";
import { authorize } from "../ai/shared.js";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import { BillingService } from "./billing-service.js";
import { CheckoutService } from "./checkout-service.js";
import { EntitlementService } from "./entitlement-service.js";
import { LedgerOps } from "./ledger-ops.js";
import { PaymentService } from "./payment-service.js";
import { registerSplitFinanceRoutes } from "./split-routes.js";
import { registerTreasuryMonetizationRoutes } from "./treasury-monetization-routes.js";

const orgScopedPaymentIntentSchema = createPaymentIntentSchema.extend({
  organizationId: uuidSchema,
});
const orgScopedManualPaymentSchema = recordManualPaymentSchema.extend({
  organizationId: uuidSchema,
});
const orgScopedRefundSchema = createRefundSchema.and(z.object({ organizationId: uuidSchema }));

type OrgParams = { organizationId?: string };
type PlanParams = OrgParams & { planId?: string };
type InvoiceParams = OrgParams & { invoiceId?: string };
type SubscriptionParams = OrgParams & { subscriptionId?: string };
type AgreementParams = OrgParams & { agreementId?: string };
type LedgerTxParams = OrgParams & { transactionId?: string };
type PaymentParams = { paymentId?: string; intentId?: string };
type WebhookParams = { provider?: string };

type RequestWithRawBody = FastifyRequest & { rawBody?: Buffer };

function financeDeps(deps: ApiDeps) {
  if (!deps.paymentProvider) {
    throw new Error("PaymentProvider não configurado em ApiDeps.");
  }
  return {
    billing: new BillingService(deps.db, deps.paymentProvider),
    checkout: new CheckoutService(deps.db, deps.paymentProvider),
    payments: new PaymentService(deps.db, deps.paymentProvider),
    ledger: new LedgerOps(deps.db, deps.paymentProvider),
    entitlements: new EntitlementService(deps.db),
  };
}

export async function registerFinanceRoutes(app: FastifyInstance, deps: ApiDeps) {
  const services = () => financeDeps(deps);
  const org = (params: OrgParams) => parseInput(uuidSchema, params.organizationId);
  const root = "/organizations/:organizationId";

  await registerSplitFinanceRoutes(app, deps);
  await registerTreasuryMonetizationRoutes(app, deps);

  /* ─── Billing ─── */

  app.get(`${root}/billing/plans`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(
      subscriptionListQuerySchema.pick({ limit: true, offset: true }),
      request.query ?? {},
    );
    return services().billing.listPlans(account, org(request.params as OrgParams), {
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/billing/plans`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createBillingPlanSchema, request.body);
    const result = await services().billing.createPlan(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/billing/plans/:planId/versions`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as PlanParams;
    return services().billing.listPlanVersions(
      account,
      org(params),
      parseInput(uuidSchema, params.planId),
    );
  });

  app.post(`${root}/billing/plans/:planId/versions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as PlanParams;
    const input = parseInput(createBillingPlanVersionSchema, request.body);
    const result = await services().billing.createPlanVersion(
      account,
      org(params),
      parseInput(uuidSchema, params.planId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/billing/plans/:planId/features`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as PlanParams;
    return services().billing.listPlanFeatures(
      account,
      org(params),
      parseInput(uuidSchema, params.planId),
    );
  });

  app.post(`${root}/billing/plans/:planId/features`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as PlanParams;
    const input = parseInput(createBillingPlanFeatureSchema, request.body);
    const result = await services().billing.addPlanFeature(
      account,
      org(params),
      parseInput(uuidSchema, params.planId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/billing/subscriptions`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(subscriptionListQuerySchema, request.query ?? {});
    return services().billing.listSubscriptions(account, org(request.params as OrgParams), {
      status: query.status,
      planId: query.planId,
      userId: query.userId,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/billing/subscriptions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createSubscriptionSchema, request.body);
    const result = await services().billing.createSubscription(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/billing/subscriptions/:subscriptionId/cancel`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as SubscriptionParams;
    const input = parseInput(cancelSubscriptionSchema, request.body ?? {});
    return services().billing.cancelSubscription(
      account,
      org(params),
      parseInput(uuidSchema, params.subscriptionId),
      input,
      meta(request),
    );
  });

  app.get(`${root}/billing/invoices`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(invoiceListQuerySchema, request.query ?? {});
    return services().billing.listInvoices(account, org(request.params as OrgParams), {
      status: query.status,
      clientId: query.clientId,
      subscriptionId: query.subscriptionId,
      from: query.from,
      to: query.to,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/billing/invoices`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createInvoiceSchema, request.body);
    const result = await services().billing.createInvoice(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/billing/invoices/:invoiceId/lines`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as InvoiceParams;
    const input = parseInput(addInvoiceLineSchema, request.body);
    const result = await services().billing.addInvoiceLine(
      account,
      org(params),
      parseInput(uuidSchema, params.invoiceId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/billing/invoices/:invoiceId/issue`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as InvoiceParams;
    return services().billing.issueInvoice(
      account,
      org(params),
      parseInput(uuidSchema, params.invoiceId),
      meta(request),
    );
  });

  app.post(`${root}/billing/invoices/:invoiceId/void`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as InvoiceParams;
    return services().billing.voidInvoice(
      account,
      org(params),
      parseInput(uuidSchema, params.invoiceId),
      meta(request),
    );
  });

  app.get(`${root}/billing/credits`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(creditListQuerySchema, request.query ?? {});
    return services().billing.listCredits(account, org(request.params as OrgParams), {
      status: query.status,
      userId: query.userId,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/billing/credits`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createBillingCreditSchema, request.body);
    const result = await services().billing.createCredit(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/billing/honorarios`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalFeeAgreementListQuerySchema, request.query ?? {});
    return services().billing.listHonorarios(account, org(request.params as OrgParams), {
      status: query.status,
      clientId: query.clientId,
      legalMatterId: query.legalMatterId,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/billing/honorarios`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLegalFeeAgreementSchema, request.body);
    const result = await services().billing.createHonorario(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/billing/honorarios/:agreementId/accruals`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as AgreementParams;
    return services().billing.listFeeAccruals(
      account,
      org(params),
      parseInput(uuidSchema, params.agreementId),
    );
  });

  app.post(`${root}/billing/honorarios/:agreementId/accruals`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as AgreementParams;
    const body = parseInput(createLegalFeeAccrualSchema, {
      ...(request.body as object),
      agreementId: parseInput(uuidSchema, params.agreementId),
    });
    const result = await services().billing.createFeeAccrual(
      account,
      org(params),
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/billing/costs`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(costRecordListQuerySchema, request.query ?? {});
    return services().billing.listCosts(account, org(request.params as OrgParams), {
      category: query.category,
      legalMatterId: query.legalMatterId,
      from: query.from,
      to: query.to,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/billing/costs`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createCostRecordSchema, request.body);
    const result = await services().billing.createCost(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/billing/platform-fee-rules`, async (request) => {
    const account = await requireAccount(deps, request);
    return services().billing.listPlatformFeeRules(account, org(request.params as OrgParams));
  });

  app.get(`${root}/billing/dashboard`, async (request) => {
    const account = await requireAccount(deps, request);
    return services().billing.dashboardSummary(account, org(request.params as OrgParams));
  });

  app.get(`${root}/billing/entitlements/:featureKey`, async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = org(request.params as OrgParams);
    const { featureKey } = request.params as OrgParams & { featureKey?: string };
    authorize(account, organizationId, (m) => policyFinanceRead(m, "finance.read"));
    const result = await services().entitlements.checkFeature({
      organizationId,
      featureKey: String(featureKey ?? ""),
    });
    return { entitlement: result };
  });

  /* ─── Ledger ─── */

  app.get(`${root}/finance/ledger/accounts`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(ledgerAccountListQuerySchema, request.query ?? {});
    return services().ledger.listAccounts(account, org(request.params as OrgParams), {
      type: query.type,
      active: query.active,
      systemAccount: query.systemAccount,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/ledger/accounts`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLedgerAccountSchema, request.body);
    if (input.systemAccount) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Contas de sistema são provisionadas automaticamente.",
      );
    }
    const result = await services().ledger.createAccount(
      account,
      org(request.params as OrgParams),
      {
        code: input.code,
        name: input.name,
        type: input.type,
        currency: input.currency,
        parentAccountId: input.parentAccountId,
        active: input.active,
      },
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/finance/ledger/transactions`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(ledgerTransactionListQuerySchema, request.query ?? {});
    return services().ledger.listTransactions(account, org(request.params as OrgParams), {
      status: query.status,
      transactionType: query.transactionType,
      referenceType: query.referenceType,
      referenceId: query.referenceId,
      from: query.from,
      to: query.to,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/ledger/manual-journal`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLedgerTransactionSchema, request.body);
    const result = await services().ledger.manualJournal(
      account,
      org(request.params as OrgParams),
      {
        ...input,
        transactionType: input.transactionType,
      },
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/finance/ledger/transactions/:transactionId/reverse`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as LedgerTxParams;
    const input = parseInput(reverseLedgerTransactionSchema, request.body);
    const result = await services().ledger.reverse(
      account,
      org(params),
      parseInput(uuidSchema, params.transactionId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/finance/ledger/balances`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(ledgerBalanceQuerySchema, request.query ?? {});
    return services().ledger.getBalances(account, org(request.params as OrgParams), query);
  });

  app.get(`${root}/finance/ledger/reconcile`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(reconciliationListQuerySchema, request.query ?? {});
    return services().ledger.listReconciliations(account, org(request.params as OrgParams), {
      status: query.status,
      providerKey: query.providerKey,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/ledger/reconcile`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createReconciliationSchema, request.body);
    const result = await services().ledger.createReconciliation(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* ─── Payments (org + global) ─── */

  app.post(`${root}/payments/intents`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createPaymentIntentSchema, request.body);
    const result = await services().payments.createIntent(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(result.alreadyExists ? 200 : 201).send(result);
  });

  app.get(`${root}/payments/intents`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(paymentIntentListQuerySchema, request.query ?? {});
    return services().payments.listIntents(account, org(request.params as OrgParams), {
      status: query.status,
      invoiceId: query.invoiceId,
      referenceType: query.referenceType,
      referenceId: query.referenceId,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.get(`${root}/payments/intents/:intentId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as OrgParams & PaymentParams;
    return services().payments.getIntent(
      account,
      org(params),
      parseInput(uuidSchema, params.intentId),
    );
  });

  app.post(`${root}/payments/checkout`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createCheckoutSchema, request.body);
    const result = await services().checkout.checkout(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(result.alreadyExists ? 200 : 201).send(result);
  });

  app.get(`${root}/payments/provider-status`, async (request) => {
    await requireAccount(deps, request);
    org(request.params as OrgParams);
    return { provider: await services().payments.providerStatus() };
  });

  app.post(`${root}/payments/manual`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(recordManualPaymentSchema, request.body);
    const result = await services().payments.recordManualPayment(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/payments`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(paymentListQuerySchema, request.query ?? {});
    return services().payments.listPayments(account, org(request.params as OrgParams), {
      status: query.status,
      paymentIntentId: query.paymentIntentId,
      isManual: query.isManual,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.get(`${root}/payments/:paymentId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as OrgParams & PaymentParams;
    return services().payments.getPayment(
      account,
      org(params),
      parseInput(uuidSchema, params.paymentId),
    );
  });

  app.post(`${root}/payments/:paymentId/refunds`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as OrgParams & PaymentParams;
    const input = parseInput(createRefundSchema, {
      ...(request.body as object),
      paymentId: parseInput(uuidSchema, params.paymentId),
    });
    const result = await services().payments.requestRefund(
      account,
      org(params),
      input.paymentId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  // Global payment routes (organizationId in body where needed)
  app.get("/payments/provider-status", async (request) => {
    await requireAccount(deps, request);
    return { provider: await services().payments.providerStatus() };
  });

  app.post("/payments/checkout", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createCheckoutSchema, request.body);
    if (!input.organizationId) {
      throw new AppError("VALIDATION_ERROR", "organizationId é obrigatório no checkout.", [
        { path: "organizationId", message: "Informe a organização." },
      ]);
    }
    const result = await services().checkout.checkout(
      account,
      input.organizationId,
      input,
      meta(request),
    );
    return reply.status(result.alreadyExists ? 200 : 201).send(result);
  });

  app.post("/payments/intents", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(orgScopedPaymentIntentSchema, request.body);
    const result = await services().payments.createIntent(
      account,
      input.organizationId,
      input,
      meta(request),
    );
    return reply.status(result.alreadyExists ? 200 : 201).send(result);
  });

  app.post("/payments/manual", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(orgScopedManualPaymentSchema, request.body);
    const result = await services().payments.recordManualPayment(
      account,
      input.organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get("/payments/intents/:intentId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as PaymentParams;
    return services().payments.getIntent(account, null, parseInput(uuidSchema, params.intentId));
  });

  app.post("/payments/:paymentId/refunds", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as PaymentParams;
    const input = parseInput(orgScopedRefundSchema, {
      ...(request.body as object),
      paymentId: parseInput(uuidSchema, params.paymentId),
    });
    const result = await services().payments.requestRefund(
      account,
      input.organizationId,
      input.paymentId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get("/payments/:paymentId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as PaymentParams;
    return services().payments.getPayment(account, null, parseInput(uuidSchema, params.paymentId));
  });

  /* ─── Webhooks (raw body, CSRF skipped via path) ─── */

  app.post(
    "/webhooks/payments/:provider",
    {
      config: { rawBody: true },
      preParsing: async (request, _reply, payload) => {
        const chunks: Buffer[] = [];
        for await (const chunk of payload) {
          chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : Buffer.from(chunk));
        }
        const raw = Buffer.concat(chunks);
        (request as RequestWithRawBody).rawBody = raw;
        return Readable.from(raw);
      },
    },
    async (request, reply) => {
      const params = request.params as WebhookParams;
      const provider = String(params.provider ?? "").toLowerCase();
      const rawBody =
        (request as RequestWithRawBody).rawBody ??
        Buffer.from(
          typeof request.body === "string" ? request.body : JSON.stringify(request.body ?? {}),
        );

      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === "string") headers[key.toLowerCase()] = value;
        else if (Array.isArray(value) && value[0]) headers[key.toLowerCase()] = value[0];
      }

      const result = await services().payments.handleWebhook({
        provider,
        rawBody,
        headers,
      });

      return reply.status(200).send(result);
    },
  );
}
