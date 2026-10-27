import {
  addMatterTeamMemberSchema,
  createCaseSchema,
  createDemandTypeSchema,
  createMatterFeeSchema,
  createMatterPartySchema,
  createMatterSchema,
  createSubareaSchema,
  matterListQuerySchema,
  matterStatusTransitionSchema,
  parseInput,
  setMatterTagsSchema,
  updateMatterFeeSchema,
  updateMatterSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  addMatterParty,
  addMatterTeamMember,
  archiveMatter,
  changeMatterStatus,
  closeMatter,
  createDemandType,
  createMatter,
  createMatterFee,
  createMatterFromOpportunity,
  createSubarea,
  getMatter,
  listDemandTypes,
  listMatters,
  listMatterTimeline,
  listSubareas,
  removeMatterParty,
  removeMatterTeamMember,
  restoreMatter,
  setMatterTags,
  updateMatter,
  updateMatterFee,
} from "./service.js";

function organizationIdFromParams(params: { organizationId?: string }): string {
  return parseInput(uuidSchema, params.organizationId);
}

export async function registerMatterRoutes(app: FastifyInstance, deps: ApiDeps) {
  app.get("/organizations/:organizationId/matters", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const query = parseInput(matterListQuerySchema, request.query ?? {});
    return await listMatters(deps.db, account, organizationId, {
      ...query,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post("/organizations/:organizationId/matters", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const body = request.body as { opportunityId?: string } & Record<string, unknown>;
    if (body.opportunityId) {
      const opportunityId = parseInput(uuidSchema, body.opportunityId);
      const input = parseInput(createCaseSchema, body);
      const matter = await createMatterFromOpportunity(
        deps.db,
        account,
        organizationId,
        opportunityId,
        input,
        meta(request),
      );
      return reply.status(201).send({ matter, case: matter });
    }
    const input = parseInput(createMatterSchema, request.body);
    const matter = await createMatter(deps.db, account, organizationId, input, meta(request));
    return reply.status(201).send({ matter });
  });

  app.get("/organizations/:organizationId/matters/:matterId", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const matterId = parseInput(uuidSchema, (request.params as { matterId?: string }).matterId);
    return { matter: await getMatter(deps.db, account, organizationId, matterId) };
  });

  app.patch("/organizations/:organizationId/matters/:matterId", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const matterId = parseInput(uuidSchema, (request.params as { matterId?: string }).matterId);
    const input = parseInput(updateMatterSchema, request.body);
    return {
      matter: await updateMatter(deps.db, account, organizationId, matterId, input, meta(request)),
    };
  });

  app.post("/organizations/:organizationId/matters/:matterId/status", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const matterId = parseInput(uuidSchema, (request.params as { matterId?: string }).matterId);
    const input = parseInput(matterStatusTransitionSchema, request.body);
    return {
      matter: await changeMatterStatus(
        deps.db,
        account,
        organizationId,
        matterId,
        input.status,
        meta(request),
      ),
    };
  });

  app.post("/organizations/:organizationId/matters/:matterId/close", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const matterId = parseInput(uuidSchema, (request.params as { matterId?: string }).matterId);
    return {
      matter: await closeMatter(deps.db, account, organizationId, matterId, meta(request)),
    };
  });

  app.post("/organizations/:organizationId/matters/:matterId/archive", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const matterId = parseInput(uuidSchema, (request.params as { matterId?: string }).matterId);
    return {
      matter: await archiveMatter(deps.db, account, organizationId, matterId, meta(request)),
    };
  });

  app.post("/organizations/:organizationId/matters/:matterId/restore", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const matterId = parseInput(uuidSchema, (request.params as { matterId?: string }).matterId);
    return {
      matter: await restoreMatter(deps.db, account, organizationId, matterId, meta(request)),
    };
  });

  app.post("/organizations/:organizationId/matters/:matterId/parties", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const matterId = parseInput(uuidSchema, (request.params as { matterId?: string }).matterId);
    const input = parseInput(createMatterPartySchema, request.body);
    const party = await addMatterParty(
      deps.db,
      account,
      organizationId,
      matterId,
      input,
      meta(request),
    );
    return reply.status(201).send({ party });
  });

  app.delete(
    "/organizations/:organizationId/matters/:matterId/parties/:partyId",
    async (request) => {
      const account = await requireAccount(deps, request);
      const organizationId = organizationIdFromParams(
        request.params as { organizationId?: string },
      );
      const params = request.params as { matterId?: string; partyId?: string };
      const matterId = parseInput(uuidSchema, params.matterId);
      const partyId = parseInput(uuidSchema, params.partyId);
      return await removeMatterParty(
        deps.db,
        account,
        organizationId,
        matterId,
        partyId,
        meta(request),
      );
    },
  );

  app.post("/organizations/:organizationId/matters/:matterId/team", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const matterId = parseInput(uuidSchema, (request.params as { matterId?: string }).matterId);
    const input = parseInput(addMatterTeamMemberSchema, request.body);
    const member = await addMatterTeamMember(
      deps.db,
      account,
      organizationId,
      matterId,
      input,
      meta(request),
    );
    return reply.status(201).send({ member });
  });

  app.delete(
    "/organizations/:organizationId/matters/:matterId/team/:teamMemberId",
    async (request) => {
      const account = await requireAccount(deps, request);
      const organizationId = organizationIdFromParams(
        request.params as { organizationId?: string },
      );
      const params = request.params as { matterId?: string; teamMemberId?: string };
      const matterId = parseInput(uuidSchema, params.matterId);
      const teamMemberId = parseInput(uuidSchema, params.teamMemberId);
      return await removeMatterTeamMember(
        deps.db,
        account,
        organizationId,
        matterId,
        teamMemberId,
        meta(request),
      );
    },
  );

  app.post("/organizations/:organizationId/matters/:matterId/fees", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const matterId = parseInput(uuidSchema, (request.params as { matterId?: string }).matterId);
    const input = parseInput(createMatterFeeSchema, request.body);
    const fee = await createMatterFee(
      deps.db,
      account,
      organizationId,
      matterId,
      input,
      meta(request),
    );
    return reply.status(201).send({ fee });
  });

  app.patch("/organizations/:organizationId/matters/:matterId/fees/:feeId", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const params = request.params as { matterId?: string; feeId?: string };
    const matterId = parseInput(uuidSchema, params.matterId);
    const feeId = parseInput(uuidSchema, params.feeId);
    const input = parseInput(updateMatterFeeSchema, request.body);
    return {
      fee: await updateMatterFee(
        deps.db,
        account,
        organizationId,
        matterId,
        feeId,
        input,
        meta(request),
      ),
    };
  });

  app.put("/organizations/:organizationId/matters/:matterId/tags", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const matterId = parseInput(uuidSchema, (request.params as { matterId?: string }).matterId);
    const input = parseInput(setMatterTagsSchema, request.body);
    return await setMatterTags(
      deps.db,
      account,
      organizationId,
      matterId,
      input.tagIds,
      meta(request),
    );
  });

  app.get("/organizations/:organizationId/matters/:matterId/timeline", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const matterId = parseInput(uuidSchema, (request.params as { matterId?: string }).matterId);
    return await listMatterTimeline(deps.db, account, organizationId, matterId);
  });

  app.get("/organizations/:organizationId/demand-types", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    return await listDemandTypes(deps.db, account, organizationId);
  });

  app.post("/organizations/:organizationId/demand-types", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const input = parseInput(createDemandTypeSchema, request.body);
    const demandType = await createDemandType(
      deps.db,
      account,
      organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send({ demandType });
  });

  app.get("/organizations/:organizationId/legal-subareas", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const query = request.query as { legalAreaId?: string };
    const legalAreaId = query.legalAreaId ? parseInput(uuidSchema, query.legalAreaId) : undefined;
    return await listSubareas(deps.db, account, organizationId, legalAreaId);
  });

  app.post("/organizations/:organizationId/legal-subareas", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = organizationIdFromParams(request.params as { organizationId?: string });
    const input = parseInput(createSubareaSchema, request.body);
    const subarea = await createSubarea(deps.db, account, organizationId, input, meta(request));
    return reply.status(201).send({ subarea });
  });
}
