import {
  accountsPayableListQuerySchema,
  apiClientListQuerySchema,
  approveAccountsPayableSchema,
  createAccountsPayableSchema,
  createApiClientSchema,
  createApiCredentialSchema,
  createExternalFinancialTransactionSchema,
  createMonetizationProductSchema,
  createProductPriceSchema,
  createReconciliationRunSchema,
  createSoftwareLicenseSchema,
  createTechnologyFeeRuleSchema,
  createTreasuryForecastSchema,
  createUsageMeterSchema,
  monetizationProductListQuerySchema,
  parseInput,
  postAiCreditTransactionSchema,
  receivableListQuerySchema,
  recordApiUsageSchema,
  recordUsageSchema,
  reconciliationRunListQuerySchema,
  resolveReconciliationItemSchema,
  softwareLicenseListQuerySchema,
  updateAccountsPayableSchema,
  updateDelinquencyCaseSchema,
  updateSoftwareLicenseSchema,
  upsertWhiteLabelConfigSchema,
  uuidSchema,
} from "@verasjuris/validation";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { meta, readAccount, requireAccount, type ApiDeps } from "../auth/routes.js";
import { MonetizationService } from "./monetization-service.js";
import { ReconciliationService } from "./reconciliation-service.js";
import { TreasuryService } from "./treasury-service.js";

const resolveDiscrepancyBodySchema = z.object({
  status: z.enum(["resolved", "dismissed", "investigating"]),
  note: z.string().trim().max(2000).optional(),
});

type OrgParams = { organizationId?: string };
type RunParams = OrgParams & { runId?: string; itemId?: string; discrepancyId?: string };
type PayableParams = OrgParams & { payableId?: string; caseId?: string; forecastId?: string };
type MonetizationParams = OrgParams & {
  clientId?: string;
  credentialId?: string;
  licenseId?: string;
};

function services(deps: ApiDeps) {
  return {
    reconciliation: new ReconciliationService(deps.db, deps.reconciliationProvider),
    treasury: new TreasuryService(deps.db),
    monetization: new MonetizationService(deps.db, deps.customDomainProvider),
  };
}

/**
 * Routes: reconciliation, treasury, monetization, public /planos.
 */
export async function registerTreasuryMonetizationRoutes(app: FastifyInstance, deps: ApiDeps) {
  const svc = () => services(deps);
  const org = (params: OrgParams) => parseInput(uuidSchema, params.organizationId);
  const root = "/organizations/:organizationId";

  /* ─── Public / authenticated plan comparison ─── */

  app.get("/planos", async (request) => {
    await readAccount(deps, request);
    const query = parseInput(
      monetizationProductListQuerySchema.pick({ limit: true, offset: true }),
      request.query ?? {},
    );
    return svc().monetization.listPublicPlans({
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  });

  /* ─── Reconciliation ─── */

  app.post(`${root}/finance/reconciliation/imports`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createExternalFinancialTransactionSchema, request.body);
    const result = await svc().reconciliation.importExternalTransactions(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/finance/reconciliation/imports`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(
      reconciliationRunListQuerySchema.pick({ limit: true, offset: true }),
      request.query ?? {},
    );
    return svc().reconciliation.listImports(account, org(request.params as OrgParams), {
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/reconciliation/runs`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createReconciliationRunSchema, request.body);
    const result = await svc().reconciliation.createRun(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/finance/reconciliation/runs`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(reconciliationRunListQuerySchema, request.query ?? {});
    return svc().reconciliation.listRuns(account, org(request.params as OrgParams), {
      status: query.status,
      from: query.from,
      to: query.to,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.get(`${root}/finance/reconciliation/runs/:runId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as RunParams;
    return svc().reconciliation.getRun(account, org(params), parseInput(uuidSchema, params.runId));
  });

  app.get(`${root}/finance/reconciliation/items`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(
      z.object({
        runId: uuidSchema.optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).max(10_000).default(0),
      }),
      request.query ?? {},
    );
    return svc().reconciliation.listItems(account, org(request.params as OrgParams), {
      runId: query.runId,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/reconciliation/items/:itemId/resolve`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as RunParams;
    const input = parseInput(resolveReconciliationItemSchema, request.body);
    const result = await svc().reconciliation.resolveItem(
      account,
      org(params),
      parseInput(uuidSchema, params.itemId),
      input,
      meta(request),
    );
    return reply.status(200).send(result);
  });

  app.get(`${root}/finance/reconciliation/discrepancies`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(
      z.object({
        status: z.string().trim().max(40).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).max(10_000).default(0),
      }),
      request.query ?? {},
    );
    return svc().reconciliation.listDiscrepancies(account, org(request.params as OrgParams), {
      status: query.status,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(
    `${root}/finance/reconciliation/discrepancies/:discrepancyId/resolve`,
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as RunParams;
      const input = parseInput(resolveDiscrepancyBodySchema, request.body);
      const result = await svc().reconciliation.resolveDiscrepancy(
        account,
        org(params),
        parseInput(uuidSchema, params.discrepancyId),
        { status: input.status, note: input.note },
        meta(request),
      );
      return reply.status(200).send(result);
    },
  );

  /* ─── Treasury ─── */

  app.get(`${root}/finance/treasury/cash`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(
      z.object({
        currency: z.string().trim().length(3).optional(),
        asOf: z.string().datetime({ offset: true }).optional(),
      }),
      request.query ?? {},
    );
    return svc().treasury.getCashPosition(account, org(request.params as OrgParams), query);
  });

  app.get(`${root}/finance/treasury/receivables`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(
      receivableListQuerySchema.extend({
        sync: z
          .union([z.literal("true"), z.literal("false")])
          .optional()
          .transform((v) => (v === undefined ? undefined : v === "true")),
      }),
      request.query ?? {},
    );
    return svc().treasury.listReceivables(account, org(request.params as OrgParams), {
      status: query.status,
      sourceType: query.sourceType,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      sync: query.sync,
    });
  });

  app.post(`${root}/finance/treasury/receivables/sync`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const result = await svc().treasury.syncReceivables(
      account,
      org(request.params as OrgParams),
      meta(request),
    );
    return reply.status(200).send(result);
  });

  app.get(`${root}/finance/treasury/payables`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(accountsPayableListQuerySchema, request.query ?? {});
    return svc().treasury.listPayables(account, org(request.params as OrgParams), {
      status: query.status,
      category: query.category,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/treasury/payables`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createAccountsPayableSchema, request.body);
    const result = await svc().treasury.createPayable(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.patch(`${root}/finance/treasury/payables/:payableId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as PayableParams;
    const input = parseInput(updateAccountsPayableSchema, request.body);
    return svc().treasury.updatePayable(
      account,
      org(params),
      parseInput(uuidSchema, params.payableId),
      input,
      meta(request),
    );
  });

  app.post(`${root}/finance/treasury/payables/:payableId/approve`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as PayableParams;
    const input = parseInput(approveAccountsPayableSchema, request.body ?? {});
    const result = await svc().treasury.approvePayable(
      account,
      org(params),
      parseInput(uuidSchema, params.payableId),
      input,
      meta(request),
    );
    return reply.status(200).send(result);
  });

  app.get(`${root}/finance/treasury/delinquency`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(
      z.object({
        stage: z
          .enum(["reminder", "notice", "negotiation", "collection", "legal", "written_off"])
          .optional(),
        status: z.enum(["open", "in_progress", "resolved", "written_off", "cancelled"]).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        offset: z.coerce.number().int().min(0).max(10_000).default(0),
      }),
      request.query ?? {},
    );
    return svc().treasury.listDelinquency(account, org(request.params as OrgParams), {
      stage: query.stage,
      status: query.status,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/treasury/delinquency/sync`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const result = await svc().treasury.syncDelinquency(
      account,
      org(request.params as OrgParams),
      meta(request),
    );
    return reply.status(200).send(result);
  });

  app.patch(`${root}/finance/treasury/delinquency/:caseId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as PayableParams;
    const input = parseInput(updateDelinquencyCaseSchema, request.body);
    return svc().treasury.updateDelinquency(
      account,
      org(params),
      parseInput(uuidSchema, params.caseId),
      input,
      meta(request),
    );
  });

  app.get(`${root}/finance/treasury/forecast`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(
      reconciliationRunListQuerySchema.pick({ limit: true, offset: true }),
      request.query ?? {},
    );
    return svc().treasury.forecast.listForecasts(account, org(request.params as OrgParams), {
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/treasury/forecast`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createTreasuryForecastSchema, request.body);
    const result = await svc().treasury.forecast.createForecast(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/finance/treasury/forecast/:forecastId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as PayableParams;
    return svc().treasury.forecast.getForecast(
      account,
      org(params),
      parseInput(uuidSchema, params.forecastId),
    );
  });

  app.post(`${root}/finance/treasury/forecast/:forecastId/refresh`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as PayableParams;
    const result = await svc().treasury.forecast.refreshVersion(
      account,
      org(params),
      parseInput(uuidSchema, params.forecastId),
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* ─── Monetization ─── */

  app.get(`${root}/monetization/products`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(monetizationProductListQuerySchema, request.query ?? {});
    return svc().monetization.listProducts(account, org(request.params as OrgParams), {
      productType: query.productType,
      active: query.active,
      public: query.public,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/monetization/products`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createMonetizationProductSchema, request.body);
    const result = await svc().monetization.createProduct(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/monetization/prices`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createProductPriceSchema, request.body);
    const result = await svc().monetization.createPrice(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/monetization/plans`, async (request) => {
    const account = await requireAccount(deps, request);
    return svc().monetization.listProducts(account, org(request.params as OrgParams), {
      productType: "subscription",
      active: true,
      limit: 50,
      offset: 0,
    });
  });

  app.post(`${root}/monetization/usage/meters`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createUsageMeterSchema, request.body);
    const result = await svc().monetization.createMeter(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/monetization/usage`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(recordUsageSchema, request.body);
    const result = await svc().monetization.recordUsage(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(result.alreadyExists ? 200 : 201).send(result);
  });

  app.get(`${root}/monetization/ai-credits`, async (request) => {
    const account = await requireAccount(deps, request);
    return svc().monetization.getOrCreateWallet(account, org(request.params as OrgParams));
  });

  app.post(`${root}/monetization/ai-credits/transactions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(postAiCreditTransactionSchema, request.body);
    const result = await svc().monetization.postAiCreditTransaction(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(result.alreadyExists ? 200 : 201).send(result);
  });

  app.get(`${root}/monetization/technology-fees`, async (request) => {
    const account = await requireAccount(deps, request);
    return svc().monetization.listTechnologyFeeRules(account, org(request.params as OrgParams));
  });

  app.post(`${root}/monetization/technology-fees`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createTechnologyFeeRuleSchema, request.body);
    const result = await svc().monetization.createTechnologyFeeRule(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/monetization/api-clients`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(apiClientListQuerySchema, request.query ?? {});
    return svc().monetization.listApiClients(account, org(request.params as OrgParams), {
      status: query.status,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/monetization/api-clients`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createApiClientSchema, request.body);
    const result = await svc().monetization.createApiClient(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/monetization/api-scopes`, async (request) => {
    const account = await requireAccount(deps, request);
    return svc().monetization.listScopes(account, org(request.params as OrgParams));
  });

  app.post(`${root}/monetization/api-clients/:clientId/credentials`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as MonetizationParams;
    const input = parseInput(createApiCredentialSchema, request.body ?? {});
    const result = await svc().monetization.createApiCredential(
      account,
      org(params),
      parseInput(uuidSchema, params.clientId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(
    `${root}/monetization/api-clients/:clientId/credentials/:credentialId/revoke`,
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as MonetizationParams;
      const result = await svc().monetization.revokeApiCredential(
        account,
        org(params),
        parseInput(uuidSchema, params.clientId),
        String(params.credentialId ?? ""),
        meta(request),
      );
      return reply.status(200).send(result);
    },
  );

  app.post(`${root}/monetization/api-clients/:clientId/usage`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as MonetizationParams;
    const input = parseInput(recordApiUsageSchema, request.body);
    const result = await svc().monetization.recordApiUsage(
      account,
      org(params),
      parseInput(uuidSchema, params.clientId),
      input,
      meta(request),
    );
    return reply.status(result.alreadyExists ? 200 : 201).send(result);
  });

  app.post(
    `${root}/monetization/api-clients/:clientId/usage/invoice-line`,
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as MonetizationParams;
      const input = parseInput(
        z.object({
          invoiceId: uuidSchema,
          periodStart: z.string().datetime({ offset: true }),
          periodEnd: z.string().datetime({ offset: true }),
          unitAmountCents: z.number().int().min(0),
          periodKey: z.string().trim().min(1).max(40),
        }),
        request.body,
      );
      const result = await svc().monetization.aggregateApiUsageToInvoiceLine(
        account,
        org(params),
        {
          apiClientId: parseInput(uuidSchema, params.clientId),
          ...input,
        },
        meta(request),
      );
      return reply.status(result.alreadyExists ? 200 : 201).send(result);
    },
  );

  app.get(`${root}/monetization/licenses`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(softwareLicenseListQuerySchema, request.query ?? {});
    return svc().monetization.listLicenses(account, org(request.params as OrgParams), {
      status: query.status,
      licenseType: query.licenseType,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/monetization/licenses`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createSoftwareLicenseSchema, request.body);
    const result = await svc().monetization.createLicense(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.patch(`${root}/monetization/licenses/:licenseId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as MonetizationParams & { licenseId?: string };
    const input = parseInput(updateSoftwareLicenseSchema, request.body);
    return svc().monetization.updateLicense(
      account,
      org(params),
      parseInput(uuidSchema, params.licenseId),
      input,
      meta(request),
    );
  });

  app.get(`${root}/monetization/white-label`, async (request) => {
    const account = await requireAccount(deps, request);
    return svc().monetization.getWhiteLabel(account, org(request.params as OrgParams));
  });

  app.put(`${root}/monetization/white-label`, async (request) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(upsertWhiteLabelConfigSchema, request.body);
    return svc().monetization.upsertWhiteLabel(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
  });

  app.post(`${root}/monetization/white-label/attach-domain`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(z.object({ domain: z.string().trim().min(3).max(253) }), request.body);
    const result = await svc().monetization.attachCustomDomain(
      account,
      org(request.params as OrgParams),
      input.domain,
      meta(request),
    );
    return reply.status(200).send(result);
  });

  app.get(`${root}/monetization/dashboard`, async (request) => {
    const account = await requireAccount(deps, request);
    return svc().monetization.dashboard(account, org(request.params as OrgParams));
  });
}
