import {
  addFinancialDisputeEvidenceSchema,
  allocatePaymentSchema,
  approveRefundSchema,
  cancelRefundSchema,
  confirmPayoutPaidSchema,
  createFinancialDisputeSchema,
  createPayoutFromPayablesSchema,
  createPayoutScheduleSchema,
  createRefundSchema,
  createSplitRuleSchema,
  financialDisputeListQuerySchema,
  holdPayableSchema,
  holdPayoutSchema,
  parseInput,
  payableListQuerySchema,
  paymentAllocationListQuerySchema,
  payoutListQuerySchema,
  processPayoutSchema,
  refundListQuerySchema,
  releasePayableSchema,
  releasePayoutSchema,
  resolveFinancialDisputeSchema,
  splitRuleListQuerySchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import { FinancialDisputeService } from "./dispute-service.js";
import { PaymentService } from "./payment-service.js";
import { PayoutService } from "./payout-service.js";
import { SplitAllocationService } from "./split-allocation-service.js";

type OrgParams = { organizationId?: string };
type IdParams = OrgParams & {
  payableId?: string;
  payoutId?: string;
  scheduleId?: string;
  refundId?: string;
  disputeId?: string;
  paymentId?: string;
};

function splitDeps(deps: ApiDeps) {
  if (!deps.paymentProvider) {
    throw new Error("PaymentProvider não configurado em ApiDeps.");
  }
  if (!deps.payoutProvider) {
    throw new Error("PayoutProvider não configurado em ApiDeps.");
  }
  if (!deps.paymentDisputeProvider) {
    throw new Error("PaymentDisputeProvider não configurado em ApiDeps.");
  }
  return {
    split: new SplitAllocationService(deps.db),
    payouts: new PayoutService(deps.db, deps.payoutProvider),
    payments: new PaymentService(deps.db, deps.paymentProvider),
    disputes: new FinancialDisputeService(deps.db, deps.paymentDisputeProvider),
  };
}

export async function registerSplitFinanceRoutes(app: FastifyInstance, deps: ApiDeps) {
  const services = () => splitDeps(deps);
  const org = (params: OrgParams) => parseInput(uuidSchema, params.organizationId);
  const root = "/organizations/:organizationId";

  /* ─── Split rules ─── */

  app.get(`${root}/finance/split-rules`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(splitRuleListQuerySchema, request.query ?? {});
    return services().split.listSplitRules(account, org(request.params as OrgParams), {
      status: query.status,
      productType: query.productType,
      beneficiaryType: query.beneficiaryType,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/split-rules`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createSplitRuleSchema, request.body);
    const result = await services().split.createSplitRule(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* ─── Allocations ─── */

  app.get(`${root}/finance/allocations`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(paymentAllocationListQuerySchema, request.query ?? {});
    return services().split.listAllocations(account, org(request.params as OrgParams), {
      status: query.status,
      paymentId: query.paymentId,
      beneficiaryType: query.beneficiaryType,
      beneficiaryId: query.beneficiaryId,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/allocations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(allocatePaymentSchema, request.body);
    const result = await services().split.allocatePayment(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* ─── Payables ─── */

  app.get(`${root}/finance/payables`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(payableListQuerySchema, request.query ?? {});
    return services().split.listPayables(account, org(request.params as OrgParams), {
      status: query.status,
      beneficiaryType: query.beneficiaryType,
      beneficiaryId: query.beneficiaryId,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/payables/:payableId/hold`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as IdParams;
    const input = parseInput(holdPayableSchema, request.body);
    const result = await services().split.holdPayable(
      account,
      org(params),
      parseInput(uuidSchema, params.payableId),
      input,
      meta(request),
    );
    return reply.status(200).send(result);
  });

  app.post(`${root}/finance/payables/:payableId/release`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as IdParams;
    const input = parseInput(releasePayableSchema, request.body ?? {});
    const result = await services().split.releasePayable(
      account,
      org(params),
      parseInput(uuidSchema, params.payableId),
      input,
      meta(request),
    );
    return reply.status(200).send(result);
  });

  /* ─── Payout schedules ─── */

  app.get(`${root}/finance/payout-schedules`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(
      payoutListQuerySchema.pick({ limit: true, offset: true }),
      request.query ?? {},
    );
    return services().payouts.listSchedules(account, org(request.params as OrgParams), {
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/payout-schedules`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createPayoutScheduleSchema, request.body);
    const result = await services().payouts.createSchedule(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  /* ─── Payouts ─── */

  app.get(`${root}/finance/payouts/provider-status`, async (request) => {
    await requireAccount(deps, request);
    org(request.params as OrgParams);
    return { provider: await services().payouts.providerStatus() };
  });

  app.get(`${root}/finance/payouts`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(payoutListQuerySchema, request.query ?? {});
    return services().payouts.listPayouts(account, org(request.params as OrgParams), {
      status: query.status,
      beneficiaryType: query.beneficiaryType,
      beneficiaryId: query.beneficiaryId,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/payouts`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createPayoutFromPayablesSchema, request.body);
    const result = await services().payouts.createFromPayables(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(result.alreadyExists ? 200 : 201).send(result);
  });

  app.post(`${root}/finance/payouts/:payoutId/process`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as IdParams;
    const input = parseInput(processPayoutSchema, request.body ?? {});
    const result = await services().payouts.processPayout(
      account,
      org(params),
      parseInput(uuidSchema, params.payoutId),
      input,
      meta(request),
    );
    return reply.status(200).send(result);
  });

  app.post(`${root}/finance/payouts/:payoutId/hold`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as IdParams;
    const input = parseInput(holdPayoutSchema, request.body);
    const result = await services().payouts.holdPayout(
      account,
      org(params),
      parseInput(uuidSchema, params.payoutId),
      input,
      meta(request),
    );
    return reply.status(200).send(result);
  });

  app.post(`${root}/finance/payouts/:payoutId/release`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as IdParams;
    const input = parseInput(releasePayoutSchema, request.body ?? {});
    const result = await services().payouts.releasePayout(
      account,
      org(params),
      parseInput(uuidSchema, params.payoutId),
      input,
      meta(request),
    );
    return reply.status(200).send(result);
  });

  app.post(`${root}/finance/payouts/:payoutId/confirm-paid`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as IdParams;
    const input = parseInput(confirmPayoutPaidSchema, request.body ?? {});
    const result = await services().payouts.confirmPaid(
      account,
      org(params),
      parseInput(uuidSchema, params.payoutId),
      input,
      meta(request),
    );
    return reply.status(200).send(result);
  });

  /* ─── Refunds (evolve PaymentService) ─── */

  app.get(`${root}/finance/refunds`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(refundListQuerySchema, request.query ?? {});
    return services().payments.listRefunds(account, org(request.params as OrgParams), {
      status: query.status,
      refundType: query.refundType,
      paymentId: query.paymentId,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/refunds`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createRefundSchema, request.body);
    const result = await services().payments.requestRefund(
      account,
      org(request.params as OrgParams),
      input.paymentId,
      input,
      meta(request),
    );
    return reply.status(result.alreadyExists ? 200 : 201).send(result);
  });

  app.post(`${root}/finance/refunds/:refundId/approve`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as IdParams;
    const input = parseInput(approveRefundSchema, request.body ?? {});
    const result = await services().payments.approveRefund(
      account,
      org(params),
      parseInput(uuidSchema, params.refundId),
      input,
      meta(request),
    );
    return reply.status(200).send(result);
  });

  app.post(`${root}/finance/refunds/:refundId/cancel`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as IdParams;
    const input = parseInput(cancelRefundSchema, request.body);
    const result = await services().payments.cancelRefund(
      account,
      org(params),
      parseInput(uuidSchema, params.refundId),
      input,
      meta(request),
    );
    return reply.status(200).send(result);
  });

  /* ─── Disputes ─── */

  app.get(`${root}/finance/disputes/provider-status`, async (request) => {
    await requireAccount(deps, request);
    org(request.params as OrgParams);
    return { provider: await services().disputes.providerStatus() };
  });

  app.get(`${root}/finance/disputes`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(financialDisputeListQuerySchema, request.query ?? {});
    return services().disputes.list(account, org(request.params as OrgParams), {
      status: query.status,
      disputeType: query.disputeType,
      paymentId: query.paymentId,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/finance/disputes`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createFinancialDisputeSchema, request.body);
    const result = await services().disputes.open(
      account,
      org(request.params as OrgParams),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/finance/disputes/:disputeId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as IdParams;
    return services().disputes.get(account, org(params), parseInput(uuidSchema, params.disputeId));
  });

  app.post(`${root}/finance/disputes/:disputeId/evidence`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as IdParams;
    const input = parseInput(addFinancialDisputeEvidenceSchema, request.body);
    const result = await services().disputes.addEvidence(
      account,
      org(params),
      parseInput(uuidSchema, params.disputeId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/finance/disputes/:disputeId/resolve`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as IdParams;
    const input = parseInput(resolveFinancialDisputeSchema, request.body);
    const result = await services().disputes.resolve(
      account,
      org(params),
      parseInput(uuidSchema, params.disputeId),
      input,
      meta(request),
    );
    return reply.status(200).send(result);
  });
}
