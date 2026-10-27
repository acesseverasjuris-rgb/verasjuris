import {
  addCalendarParticipantSchema,
  calendarListQuerySchema,
  createCalendarEventSchema,
  linkHearingSchema,
  parseInput,
  rescheduleCalendarEventSchema,
  updateCalendarEventSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  addParticipant,
  cancelCalendarEvent,
  countCalendarOverview,
  createCalendarEvent,
  getCalendarEvent,
  linkHearingToCalendar,
  listCalendarEvents,
  rescheduleCalendarEvent,
  updateCalendarEvent,
} from "./service.js";

function orgId(params: { organizationId?: string }): string {
  return parseInput(uuidSchema, params.organizationId);
}

export async function registerCalendarRoutes(app: FastifyInstance, deps: ApiDeps) {
  app.get("/organizations/:organizationId/calendar/overview", async (request) => {
    const account = await requireAccount(deps, request);
    return countCalendarOverview(
      deps.db,
      account,
      orgId(request.params as { organizationId?: string }),
    );
  });

  app.get("/organizations/:organizationId/calendar/events", async (request) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const query = parseInput(calendarListQuerySchema, request.query ?? {});
    return listCalendarEvents(deps.db, account, organizationId, query);
  });

  app.post("/organizations/:organizationId/calendar/events", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const input = parseInput(createCalendarEventSchema, request.body);
    const result = await createCalendarEvent(
      deps.db,
      account,
      organizationId,
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get("/organizations/:organizationId/calendar/events/:eventId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; eventId?: string };
    return getCalendarEvent(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.eventId),
    );
  });

  app.patch("/organizations/:organizationId/calendar/events/:eventId", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; eventId?: string };
    const input = parseInput(updateCalendarEventSchema, request.body);
    return updateCalendarEvent(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.eventId),
      input,
      meta(request),
    );
  });

  app.post(
    "/organizations/:organizationId/calendar/events/:eventId/reschedule",
    async (request) => {
      const account = await requireAccount(deps, request);
      const params = request.params as { organizationId?: string; eventId?: string };
      const input = parseInput(rescheduleCalendarEventSchema, request.body);
      return rescheduleCalendarEvent(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.eventId),
        input,
        meta(request),
      );
    },
  );

  app.post("/organizations/:organizationId/calendar/events/:eventId/cancel", async (request) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { organizationId?: string; eventId?: string };
    return cancelCalendarEvent(
      deps.db,
      account,
      orgId(params),
      parseInput(uuidSchema, params.eventId),
      meta(request),
    );
  });

  app.post(
    "/organizations/:organizationId/calendar/events/:eventId/participants",
    async (request, reply) => {
      const account = await requireAccount(deps, request);
      const params = request.params as { organizationId?: string; eventId?: string };
      const input = parseInput(addCalendarParticipantSchema, request.body);
      const participant = await addParticipant(
        deps.db,
        account,
        orgId(params),
        parseInput(uuidSchema, params.eventId),
        input,
        meta(request),
      );
      return reply.status(201).send({ participant });
    },
  );

  app.post("/organizations/:organizationId/calendar/link-hearing", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const organizationId = orgId(request.params as { organizationId?: string });
    const input = parseInput(linkHearingSchema, request.body);
    const result = await linkHearingToCalendar(
      deps.db,
      account,
      organizationId,
      input.judicialHearingId,
      meta(request),
    );
    return reply.status(result.created ? 201 : 200).send(result);
  });
}
