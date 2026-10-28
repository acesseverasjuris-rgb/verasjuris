import {
  acceptExtrajudicialQuoteSchema,
  createExtrajudicialQuoteSchema,
  createExtrajudicialRequirementSchema,
  createExtrajudicialServiceRequestSchema,
  createRegistryOfficeSchema,
  parseInput,
  recordManualExtrajudicialProtocolSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  acceptExtrajudicialQuote,
  completeExtrajudicialOrder,
  createExtrajudicialQuote,
  createExtrajudicialRequirement,
  createExtrajudicialServiceRequest,
  createRegistryOffice,
  getExtrajudicialPaymentStatus,
  getExtrajudicialProvidersStatus,
  getExtrajudicialRequest,
  listExtrajudicialRequests,
  listExtrajudicialServiceTypes,
  listRegistryOffices,
  recordExtrajudicialDelivery,
  recordManualExtrajudicialProtocol,
  submitExtrajudicialOrderViaProvider,
  type ExtrajudicialModuleDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  requestId?: string;
  orderId?: string;
  quoteId?: string;
};

function extrajudicialDeps(deps: ApiDeps): ExtrajudicialModuleDeps {
  if (!deps.paymentProvider || !deps.registryProvider || !deps.feeTableProvider) {
    throw new Error("Provedores extrajudiciais não configurados em ApiDeps.");
  }
  return {
    paymentProvider: deps.paymentProvider,
    registryProvider: deps.registryProvider,
    feeTableProvider: deps.feeTableProvider,
  };
}

export async function registerExtrajudicialRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId/extrajudicial";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const moduleDeps = () => extrajudicialDeps(deps);

  app.get(`${root}/providers/status`, async (request) => {
    await requireAccount(deps, request);
    return getExtrajudicialProvidersStatus(moduleDeps());
  });

  app.get(`${root}/service-types`, async (request) => {
    await requireAccount(deps, request);
    return listExtrajudicialServiceTypes(deps.db);
  });

  app.get(`${root}/registry-offices`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = request.query as { state?: string; city?: string };
    return listRegistryOffices(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/registry-offices`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createRegistryOfficeSchema, request.body);
    const result = await createRegistryOffice(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/requests`, async (request) => {
    const account = await requireAccount(deps, request);
    return listExtrajudicialRequests(deps.db, account, org(request.params as Params));
  });

  app.post(`${root}/requests`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createExtrajudicialServiceRequestSchema, request.body);
    const result = await createExtrajudicialServiceRequest(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/requests/:requestId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getExtrajudicialRequest(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
    );
  });

  app.post(`${root}/requests/:requestId/quotes`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(createExtrajudicialQuoteSchema, {
      ...(request.body as object),
      serviceRequestId: params.requestId,
    });
    const result = await createExtrajudicialQuote(
      deps.db,
      account,
      org(params),
      body,
      meta(request),
      moduleDeps(),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/requests/:requestId/quotes/:quoteId/accept`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    parseInput(acceptExtrajudicialQuoteSchema, { quoteId: params.quoteId });
    const result = await acceptExtrajudicialQuote(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
      parseInput(uuidSchema, params.quoteId),
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/orders/:orderId/submit-provider`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return submitExtrajudicialOrderViaProvider(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.orderId),
      meta(request),
      moduleDeps(),
    );
  });

  app.post(`${root}/orders/:orderId/protocol-manual`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(recordManualExtrajudicialProtocolSchema, request.body);
    return recordManualExtrajudicialProtocol(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.orderId),
      input,
      meta(request),
    );
  });

  app.post(`${root}/orders/:orderId/requirements`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createExtrajudicialRequirementSchema, request.body);
    const result = await createExtrajudicialRequirement(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.orderId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/orders/:orderId/deliveries`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = (request.body ?? {}) as {
      deliveryType?:
        | "digital_document"
        | "physical_pickup"
        | "courier"
        | "registry_portal"
        | "other";
      documentId?: string;
      externalReference?: string;
      evidenceNotes?: string;
    };
    const result = await recordExtrajudicialDelivery(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.orderId),
      body,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/orders/:orderId/complete`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return completeExtrajudicialOrder(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.orderId),
      meta(request),
    );
  });

  app.get(`${root}/payment/status`, async (request) => {
    const account = await requireAccount(deps, request);
    return getExtrajudicialPaymentStatus(
      deps.db,
      account,
      org(request.params as Params),
      moduleDeps(),
    );
  });
}
