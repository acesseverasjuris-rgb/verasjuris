import {
  acceptConsultationTermsSchema,
  createLawyerAvailabilityOverrideSchema,
  createLawyerAvailabilitySchema,
  createOnlineConsultationReviewSchema,
  createOnlineLegalRequestSchema,
  generateOnlineMatchCandidatesSchema,
  manualOnlineConsultationPaymentSchema,
  onlineLawyerListQuerySchema,
  parseInput,
  patchOnlineLawyerProfileSchema,
  scheduleOnlineConsultationSchema,
  completeOnlineConsultationSchema,
  updateLawyerAvailabilitySchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  acceptConsultationTerms,
  acceptMatchCandidate,
  assertLawyerCanReadRequestDocument,
  cancelOnlineLegalRequest,
  completeOnlineConsultation,
  createLawyerAvailabilityOverride,
  createLawyerAvailabilitySlot,
  createOnlineConsultationReview,
  createOnlineLegalRequest,
  declineMatchCandidate,
  deleteLawyerAvailabilityOverride,
  deleteLawyerAvailabilitySlot,
  generateMatchCandidates,
  getOnlineConsultation,
  getOnlineLawyerProvidersStatus,
  getOnlineLegalRequest,
  listLawyerAvailability,
  listLawyerAvailabilityOverrides,
  listLawyerOfferedMatches,
  listOnlineConsultations,
  listOnlineLegalRequests,
  listRequestMatchCandidates,
  patchOnlineLawyerProfileFields,
  recordManualConsultationPayment,
  scheduleOnlineConsultation,
  startOnlineConsultation,
  updateLawyerAvailabilityOverride,
  updateLawyerAvailabilitySlot,
  verifyLawyerOabWithProvider,
  type OnlineLawyerModuleDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  requestId?: string;
  matchId?: string;
  consultationId?: string;
  availabilityId?: string;
  overrideId?: string;
  documentId?: string;
};

function onlineLawyerDeps(deps: ApiDeps): OnlineLawyerModuleDeps {
  if (
    !deps.paymentProvider ||
    !deps.oabVerificationProvider ||
    !deps.conflictCheckProvider ||
    !deps.videoConferenceProvider
  ) {
    throw new Error("Provedores de Advogado Online não configurados em ApiDeps.");
  }
  return {
    paymentProvider: deps.paymentProvider,
    oabVerificationProvider: deps.oabVerificationProvider,
    conflictCheckProvider: deps.conflictCheckProvider,
    videoConferenceProvider: deps.videoConferenceProvider,
  };
}

export async function registerOnlineLawyerRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const moduleDeps = () => onlineLawyerDeps(deps);

  app.get(`${root}/online-lawyer/providers/status`, async (request) => {
    const account = await requireAccount(deps, request);
    return getOnlineLawyerProvidersStatus(account, org(request.params as Params), moduleDeps());
  });

  app.post(`${root}/online-legal-requests`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createOnlineLegalRequestSchema, request.body);
    const result = await createOnlineLegalRequest(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/online-legal-requests`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(onlineLawyerListQuerySchema, request.query ?? {});
    return listOnlineLegalRequests(deps.db, account, org(request.params as Params), {
      status: query.status,
      stateCode: query.stateCode,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.get(`${root}/online-legal-requests/:requestId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getOnlineLegalRequest(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
    );
  });

  app.post(`${root}/online-legal-requests/:requestId/matches/generate`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const body = parseInput(generateOnlineMatchCandidatesSchema, request.body ?? {});
    return generateMatchCandidates(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
      body,
      meta(request),
    );
  });

  app.get(`${root}/online-legal-requests/:requestId/matches`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return listRequestMatchCandidates(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
    );
  });

  app.post(`${root}/online-legal-requests/:requestId/cancel`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return cancelOnlineLegalRequest(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.requestId),
      meta(request),
    );
  });

  app.get(`${root}/online-lawyer/matches`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(onlineLawyerListQuerySchema, request.query ?? {});
    return listLawyerOfferedMatches(deps.db, account, org(request.params as Params), {
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(`${root}/online-lawyer/matches/:matchId/accept`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const result = await acceptMatchCandidate(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.matchId),
      moduleDeps(),
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/online-lawyer/matches/:matchId/decline`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return declineMatchCandidate(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.matchId),
      meta(request),
    );
  });

  app.post(`${root}/online-lawyer/availability`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLawyerAvailabilitySchema, request.body);
    const result = await createLawyerAvailabilitySlot(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/online-lawyer/availability`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = request.query as { lawyerProfileId?: string };
    const lawyerProfileId = parseInput(uuidSchema, query.lawyerProfileId ?? account.user.id);
    return listLawyerAvailability(deps.db, account, org(request.params as Params), lawyerProfileId);
  });

  app.patch(`${root}/online-lawyer/availability/:availabilityId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(updateLawyerAvailabilitySchema, request.body);
    return updateLawyerAvailabilitySlot(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.availabilityId),
      input,
      meta(request),
    );
  });

  app.delete(`${root}/online-lawyer/availability/:availabilityId`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    await deleteLawyerAvailabilitySlot(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.availabilityId),
      meta(request),
    );
    return reply.status(204).send();
  });

  app.post(`${root}/online-lawyer/availability-overrides`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLawyerAvailabilityOverrideSchema, request.body);
    const result = await createLawyerAvailabilityOverride(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/online-lawyer/availability-overrides`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = request.query as { lawyerProfileId?: string };
    const lawyerProfileId = parseInput(uuidSchema, query.lawyerProfileId ?? account.user.id);
    return listLawyerAvailabilityOverrides(
      deps.db,
      account,
      org(request.params as Params),
      lawyerProfileId,
    );
  });

  app.patch(`${root}/online-lawyer/availability-overrides/:overrideId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(
      createLawyerAvailabilityOverrideSchema.partial().refine((v) => Object.keys(v).length > 0, {
        message: "Informe ao menos um campo.",
      }),
      request.body,
    );
    return updateLawyerAvailabilityOverride(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.overrideId),
      input,
      meta(request),
    );
  });

  app.delete(`${root}/online-lawyer/availability-overrides/:overrideId`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    await deleteLawyerAvailabilityOverride(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.overrideId),
      meta(request),
    );
    return reply.status(204).send();
  });

  app.patch(`${root}/online-lawyer/profile`, async (request) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(patchOnlineLawyerProfileSchema, request.body);
    return patchOnlineLawyerProfileFields(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
  });

  app.post(`${root}/online-lawyer/profile/verify-oab`, async (request) => {
    const account = await requireAccount(deps, request);
    return verifyLawyerOabWithProvider(
      deps.db,
      account,
      org(request.params as Params),
      moduleDeps(),
      meta(request),
    );
  });

  app.get(`${root}/online-consultations`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(onlineLawyerListQuerySchema, request.query ?? {});
    return listOnlineConsultations(deps.db, account, org(request.params as Params), {
      status: query.status,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.get(`${root}/online-consultations/:consultationId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return getOnlineConsultation(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.consultationId),
      moduleDeps(),
    );
  });

  app.post(`${root}/online-consultations/:consultationId/accept-terms`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(acceptConsultationTermsSchema, request.body);
    const result = await acceptConsultationTerms(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.consultationId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/online-consultations/:consultationId/schedule`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(scheduleOnlineConsultationSchema, request.body);
    return scheduleOnlineConsultation(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.consultationId),
      input,
      moduleDeps(),
      meta(request),
    );
  });

  app.post(`${root}/online-consultations/:consultationId/start`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    return startOnlineConsultation(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.consultationId),
      meta(request),
    );
  });

  app.post(`${root}/online-consultations/:consultationId/complete`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(completeOnlineConsultationSchema, request.body ?? {});
    return completeOnlineConsultation(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.consultationId),
      input,
      meta(request),
    );
  });

  app.post(
    `${root}/online-consultations/:consultationId/manual-payment`,
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as Params;
      const input = parseInput(manualOnlineConsultationPaymentSchema, request.body);
      const result = await recordManualConsultationPayment(
        deps.db,
        account,
        org(params),
        parseInput(uuidSchema, params.consultationId),
        input,
        moduleDeps(),
        meta(request),
      );
      return reply.status(201).send(result);
    },
  );

  app.post(`${root}/online-consultations/:consultationId/review`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as Params;
    const input = parseInput(createOnlineConsultationReviewSchema, {
      ...(request.body as object),
      consultationId: params.consultationId,
    });
    const result = await createOnlineConsultationReview(
      deps.db,
      account,
      org(params),
      parseInput(uuidSchema, params.consultationId),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(
    `${root}/online-legal-requests/:requestId/documents/:documentId/access-check`,
    async (request) => {
      const account = await requireAccount(deps, request);
      const params = request.params as Params;
      const doc = await assertLawyerCanReadRequestDocument(
        deps.db,
        account,
        org(params),
        parseInput(uuidSchema, params.documentId),
        parseInput(uuidSchema, params.requestId),
      );
      return { documentId: doc.id, accessible: true };
    },
  );
}
