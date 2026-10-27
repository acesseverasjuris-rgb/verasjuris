import {
  changeJudicialPhaseSchema,
  closeJudicialProcessSchema,
  createJudicialAppealSchema,
  createJudicialDecisionSchema,
  createJudicialEnforcementSchema,
  createJudicialHearingSchema,
  createJudicialLawyerSchema,
  createJudicialMovementSchema,
  createJudicialPartySchema,
  createJudicialProcessSchema,
  judicialProcessListQuerySchema,
  parseInput,
  reopenJudicialProcessSchema,
  updateJudicialAppealSchema,
  updateJudicialHearingSchema,
  updateJudicialProcessSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  addJudicialAppeal,
  addJudicialDecision,
  addJudicialEnforcement,
  addJudicialHearing,
  addJudicialLawyer,
  addJudicialMovement,
  addJudicialParty,
  changeJudicialPhase,
  closeJudicialProcess,
  createJudicialProcess,
  getJudicialProcess,
  listCourtUnitsCatalog,
  listCourtsCatalog,
  listJudicialAppeals,
  listJudicialDecisions,
  listJudicialDistrictsCatalog,
  listJudicialEnforcements,
  listJudicialHearings,
  listJudicialLawyers,
  listJudicialMovements,
  listJudicialParties,
  listJudicialPhasesCatalog,
  listJudicialProcesses,
  listJudicialProcessTimeline,
  listPhaseHistory,
  listProceduralClassesCatalog,
  listProceduralSubjectsCatalog,
  reopenJudicialProcess,
  updateJudicialAppeal,
  updateJudicialHearing,
  updateJudicialProcess,
} from "./service.js";

function orgId(params: { organizationId?: string }): string {
  return parseInput(uuidSchema, params.organizationId);
}

function matterId(params: { matterId?: string }): string {
  return parseInput(uuidSchema, params.matterId);
}

function processId(params: { processId?: string }): string {
  return parseInput(uuidSchema, params.processId);
}

export async function registerJudicialRoutes(app: FastifyInstance, deps: ApiDeps) {
  app.get("/organizations/:organizationId/courts", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const items = await listCourtsCatalog(deps.db, account, organizationId);
    return { courts: items, items };
  });

  app.get("/organizations/:organizationId/court-units", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const query = request.query as { tribunalId?: string };
    const tribunalId = query.tribunalId ? parseInput(uuidSchema, query.tribunalId) : undefined;
    const items = await listCourtUnitsCatalog(deps.db, account, organizationId, tribunalId);
    return { courtUnits: items, items };
  });

  app.get("/organizations/:organizationId/judicial-districts", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const items = await listJudicialDistrictsCatalog(deps.db, account, organizationId);
    return { judicialDistricts: items, districts: items, items };
  });

  app.get("/organizations/:organizationId/procedural-classes", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const items = await listProceduralClassesCatalog(deps.db, account, organizationId);
    return { proceduralClasses: items, items };
  });

  app.get("/organizations/:organizationId/procedural-subjects", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const items = await listProceduralSubjectsCatalog(deps.db, account, organizationId);
    return { proceduralSubjects: items, items };
  });

  app.get("/organizations/:organizationId/judicial-phases", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const items = await listJudicialPhasesCatalog(deps.db, account, organizationId);
    return { judicialPhases: items, phases: items, items };
  });

  const processBase = "/organizations/:organizationId/matters/:matterId/judicial-processes";

  app.get(processBase, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; matterId?: string };
    const organizationId = orgId(params);
    const matter = matterId(params);
    const query = parseInput(judicialProcessListQuerySchema, request.query ?? {});
    return await listJudicialProcesses(deps.db, account, organizationId, matter, {
      ...query,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    });
  });

  app.post(processBase, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; matterId?: string };
    const organizationId = orgId(params);
    const matter = matterId(params);
    const input = parseInput(createJudicialProcessSchema, request.body);
    const process = await createJudicialProcess(
      deps.db,
      account,
      organizationId,
      matter,
      input,
      meta(request),
    );
    return reply.status(201).send({ process });
  });

  app.get(`${processBase}/:processId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    return {
      process: await getJudicialProcess(
        deps.db,
        account,
        orgId(params),
        matterId(params),
        processId(params),
      ),
    };
  });

  app.patch(`${processBase}/:processId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    const input = parseInput(updateJudicialProcessSchema, request.body);
    return {
      process: await updateJudicialProcess(
        deps.db,
        account,
        orgId(params),
        matterId(params),
        processId(params),
        input,
        meta(request),
      ),
    };
  });

  app.post(`${processBase}/:processId/close`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    const input = parseInput(closeJudicialProcessSchema, request.body ?? {});
    return {
      process: await closeJudicialProcess(
        deps.db,
        account,
        orgId(params),
        matterId(params),
        processId(params),
        input,
        meta(request),
      ),
    };
  });

  app.post(`${processBase}/:processId/reopen`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    const input = parseInput(reopenJudicialProcessSchema, request.body ?? {});
    return {
      process: await reopenJudicialProcess(
        deps.db,
        account,
        orgId(params),
        matterId(params),
        processId(params),
        input,
        meta(request),
      ),
    };
  });

  app.post(`${processBase}/:processId/phases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    const input = parseInput(changeJudicialPhaseSchema, request.body);
    const process = await changeJudicialPhase(
      deps.db,
      account,
      orgId(params),
      matterId(params),
      processId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ process });
  });

  app.get(`${processBase}/:processId/phases`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    const items = await listPhaseHistory(
      deps.db,
      account,
      orgId(params),
      matterId(params),
      processId(params),
    );
    return { phases: items, items };
  });

  app.get(`${processBase}/:processId/parties`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    return {
      items: await listJudicialParties(
        deps.db,
        account,
        orgId(params),
        matterId(params),
        processId(params),
      ),
    };
  });

  app.post(`${processBase}/:processId/parties`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    const input = parseInput(createJudicialPartySchema, request.body);
    const party = await addJudicialParty(
      deps.db,
      account,
      orgId(params),
      matterId(params),
      processId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ party });
  });

  app.get(`${processBase}/:processId/lawyers`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    return {
      items: await listJudicialLawyers(
        deps.db,
        account,
        orgId(params),
        matterId(params),
        processId(params),
      ),
    };
  });

  app.post(`${processBase}/:processId/lawyers`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    const input = parseInput(createJudicialLawyerSchema, request.body);
    const lawyer = await addJudicialLawyer(
      deps.db,
      account,
      orgId(params),
      matterId(params),
      processId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ lawyer });
  });

  app.get(`${processBase}/:processId/movements`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    return {
      items: await listJudicialMovements(
        deps.db,
        account,
        orgId(params),
        matterId(params),
        processId(params),
      ),
    };
  });

  app.post(`${processBase}/:processId/movements`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    const input = parseInput(createJudicialMovementSchema, request.body);
    const movement = await addJudicialMovement(
      deps.db,
      account,
      orgId(params),
      matterId(params),
      processId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ movement });
  });

  app.get(`${processBase}/:processId/hearings`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    return {
      items: await listJudicialHearings(
        deps.db,
        account,
        orgId(params),
        matterId(params),
        processId(params),
      ),
    };
  });

  app.post(`${processBase}/:processId/hearings`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    const input = parseInput(createJudicialHearingSchema, request.body);
    const hearing = await addJudicialHearing(
      deps.db,
      account,
      orgId(params),
      matterId(params),
      processId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ hearing });
  });

  app.patch(`${processBase}/:processId/hearings/:hearingId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
      hearingId?: string;
    };
    const input = parseInput(updateJudicialHearingSchema, request.body);
    return {
      hearing: await updateJudicialHearing(
        deps.db,
        account,
        orgId(params),
        matterId(params),
        processId(params),
        parseInput(uuidSchema, params.hearingId),
        input,
        meta(request),
      ),
    };
  });

  app.get(`${processBase}/:processId/decisions`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    return {
      items: await listJudicialDecisions(
        deps.db,
        account,
        orgId(params),
        matterId(params),
        processId(params),
      ),
    };
  });

  app.post(`${processBase}/:processId/decisions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    const input = parseInput(createJudicialDecisionSchema, request.body);
    const decision = await addJudicialDecision(
      deps.db,
      account,
      orgId(params),
      matterId(params),
      processId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ decision });
  });

  app.get(`${processBase}/:processId/appeals`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    return {
      items: await listJudicialAppeals(
        deps.db,
        account,
        orgId(params),
        matterId(params),
        processId(params),
      ),
    };
  });

  app.post(`${processBase}/:processId/appeals`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    const input = parseInput(createJudicialAppealSchema, request.body);
    const appeal = await addJudicialAppeal(
      deps.db,
      account,
      orgId(params),
      matterId(params),
      processId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ appeal });
  });

  app.patch(`${processBase}/:processId/appeals/:appealId`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
      appealId?: string;
    };
    const input = parseInput(updateJudicialAppealSchema, request.body);
    return {
      appeal: await updateJudicialAppeal(
        deps.db,
        account,
        orgId(params),
        matterId(params),
        processId(params),
        parseInput(uuidSchema, params.appealId),
        input,
        meta(request),
      ),
    };
  });

  app.get(`${processBase}/:processId/enforcement`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    return {
      items: await listJudicialEnforcements(
        deps.db,
        account,
        orgId(params),
        matterId(params),
        processId(params),
      ),
    };
  });

  app.post(`${processBase}/:processId/enforcement`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    const input = parseInput(createJudicialEnforcementSchema, request.body);
    const enforcement = await addJudicialEnforcement(
      deps.db,
      account,
      orgId(params),
      matterId(params),
      processId(params),
      input,
      meta(request),
    );
    return reply.status(201).send({ enforcement });
  });

  app.get(`${processBase}/:processId/timeline`, async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as {
      organizationId?: string;
      matterId?: string;
      processId?: string;
    };
    const items = await listJudicialProcessTimeline(
      deps.db,
      account,
      orgId(params),
      matterId(params),
      processId(params),
    );
    return { timeline: items, items };
  });
}
