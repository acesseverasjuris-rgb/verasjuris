import { recordAudit } from "@verasjuris/audit";
import {
  assertCalendarEventTransition,
  policyCalendar,
  type CalendarEventStatus,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  calendarEventParticipants,
  calendarEvents,
  judicialHearings,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, count, eq, gt, gte, lt, lte, ne, or } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";

type DbTx = Parameters<Parameters<AppDatabase["transaction"]>[0]>[0];

function membershipOf(account: SessionAccount, organizationId: string) {
  return account.memberships.find((item) => item.organizationId === organizationId) ?? null;
}

function accessOf(account: SessionAccount, organizationId: string) {
  const membership = membershipOf(account, organizationId);
  return membership
    ? {
        status: membership.membershipStatus,
        organizationStatus: membership.organizationStatus,
        permissions: membership.permissions,
        roles: membership.roles,
      }
    : null;
}

function requireCalendarPermission(
  account: SessionAccount,
  organizationId: string,
  permission: Parameters<typeof policyCalendar>[1],
) {
  const decision = policyCalendar(accessOf(account, organizationId), permission);
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membershipOf(account, organizationId)!;
}

function serializeEvent(row: typeof calendarEvents.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    description: row.description,
    eventType: row.eventType,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    timezone: row.timezone,
    allDay: row.allDay,
    locationType: row.locationType,
    locationText: row.locationText,
    meetingUrl: row.meetingUrl,
    status: row.status,
    recurrence: row.recurrence,
    legalMatterId: row.legalMatterId,
    judicialProcessId: row.judicialProcessId,
    administrativeProcessId: row.administrativeProcessId,
    taskId: row.taskId,
    judicialHearingId: row.judicialHearingId,
    responsibleMembershipId: row.responsibleMembershipId,
    createdByMembershipId: row.createdByMembershipId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    externalSync: "NOT_CONFIGURED" as const,
    note: "Sem sincronização Google/Outlook nesta versão.",
  };
}

async function requireEvent(db: AppDatabase | DbTx, organizationId: string, eventId: string) {
  const row = await db.query.calendarEvents.findFirst({
    where: and(eq(calendarEvents.id, eventId), eq(calendarEvents.organizationId, organizationId)),
  });
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos este compromisso no seu acesso.");
  return row;
}

/** Conflito: sobreposição de horário do responsável — aviso, não bloqueio. */
export async function detectConflicts(
  db: AppDatabase | DbTx,
  organizationId: string,
  input: {
    startsAt: Date;
    endsAt: Date;
    responsibleMembershipId?: string | null;
    excludeEventId?: string;
  },
) {
  if (!input.responsibleMembershipId) return [] as Array<{ id: string; title: string }>;
  const conditions = [
    eq(calendarEvents.organizationId, organizationId),
    eq(calendarEvents.responsibleMembershipId, input.responsibleMembershipId),
    ne(calendarEvents.status, "cancelled"),
    ltOverlap(input.startsAt, input.endsAt),
  ];
  if (input.excludeEventId) {
    conditions.push(ne(calendarEvents.id, input.excludeEventId));
  }
  const rows = await db.query.calendarEvents.findMany({
    where: and(...conditions),
    columns: { id: true, title: true, startsAt: true, endsAt: true },
    limit: 20,
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt.toISOString(),
  }));
}

function ltOverlap(startsAt: Date, endsAt: Date) {
  return and(lt(calendarEvents.startsAt, endsAt), gt(calendarEvents.endsAt, startsAt))!;
}

export async function listCalendarEvents(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    from?: string;
    to?: string;
    status?: CalendarEventStatus;
    eventType?: typeof calendarEvents.$inferSelect.eventType;
    responsibleMembershipId?: string;
    legalMatterId?: string;
    judicialProcessId?: string;
    limit: number;
    offset: number;
  },
) {
  requireCalendarPermission(account, organizationId, "calendar.read");
  const conditions = [eq(calendarEvents.organizationId, organizationId)];
  if (query.from) conditions.push(gte(calendarEvents.startsAt, new Date(query.from)));
  if (query.to) conditions.push(lte(calendarEvents.startsAt, new Date(query.to)));
  if (query.status) conditions.push(eq(calendarEvents.status, query.status));
  if (query.eventType) conditions.push(eq(calendarEvents.eventType, query.eventType));
  if (query.responsibleMembershipId) {
    conditions.push(eq(calendarEvents.responsibleMembershipId, query.responsibleMembershipId));
  }
  if (query.legalMatterId) conditions.push(eq(calendarEvents.legalMatterId, query.legalMatterId));
  if (query.judicialProcessId) {
    conditions.push(eq(calendarEvents.judicialProcessId, query.judicialProcessId));
  }
  const where = and(...conditions);
  const [rows, totalRow] = await Promise.all([
    db.query.calendarEvents.findMany({
      where,
      orderBy: [asc(calendarEvents.startsAt)],
      limit: query.limit,
      offset: query.offset,
    }),
    db.select({ value: count() }).from(calendarEvents).where(where),
  ]);
  return {
    events: rows.map(serializeEvent),
    total: totalRow[0]?.value ?? 0,
    externalSync: "NOT_CONFIGURED" as const,
  };
}

export async function getCalendarEvent(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  eventId: string,
) {
  requireCalendarPermission(account, organizationId, "calendar.read");
  const event = await requireEvent(db, organizationId, eventId);
  const participants = await db.query.calendarEventParticipants.findMany({
    where: eq(calendarEventParticipants.calendarEventId, eventId),
  });
  const conflicts = await detectConflicts(db, organizationId, {
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    responsibleMembershipId: event.responsibleMembershipId,
    excludeEventId: event.id,
  });
  return {
    event: serializeEvent(event),
    participants: participants.map((p) => ({
      id: p.id,
      membershipId: p.membershipId,
      displayName: p.displayName,
      email: p.email,
      roleLabel: p.roleLabel,
    })),
    conflicts,
    conflictWarning:
      conflicts.length > 0
        ? "Há sobreposição de horário com outro compromisso do responsável (aviso, não bloqueio)."
        : null,
  };
}

export async function createCalendarEvent(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    title: string;
    description?: string;
    eventType?: typeof calendarEvents.$inferInsert.eventType;
    startsAt: string;
    endsAt: string;
    timezone?: string;
    allDay?: boolean;
    locationType?: typeof calendarEvents.$inferInsert.locationType;
    locationText?: string;
    meetingUrl?: string;
    status?: CalendarEventStatus;
    recurrence?: typeof calendarEvents.$inferInsert.recurrence;
    legalMatterId?: string;
    judicialProcessId?: string;
    administrativeProcessId?: string;
    taskId?: string;
    judicialHearingId?: string;
    responsibleMembershipId?: string;
    participants?: Array<{
      membershipId?: string;
      displayName?: string;
      email?: string;
      roleLabel?: string;
    }>;
  },
  meta: RequestMeta,
) {
  const actor = requireCalendarPermission(account, organizationId, "calendar.create");
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  const conflicts = await detectConflicts(db, organizationId, {
    startsAt,
    endsAt,
    responsibleMembershipId: input.responsibleMembershipId ?? null,
  });

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(calendarEvents)
      .values({
        organizationId,
        title: input.title,
        description: input.description ?? null,
        eventType: input.eventType ?? "other",
        startsAt,
        endsAt,
        timezone: input.timezone ?? "America/Sao_Paulo",
        allDay: input.allDay ?? false,
        locationType: input.locationType ?? "undetermined",
        locationText: input.locationText ?? null,
        meetingUrl: input.meetingUrl ?? null,
        status: input.status ?? "scheduled",
        recurrence: input.recurrence ?? "none",
        legalMatterId: input.legalMatterId ?? null,
        judicialProcessId: input.judicialProcessId ?? null,
        administrativeProcessId: input.administrativeProcessId ?? null,
        taskId: input.taskId ?? null,
        judicialHearingId: input.judicialHearingId ?? null,
        responsibleMembershipId: input.responsibleMembershipId ?? null,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o compromisso.");

    if (input.participants?.length) {
      await tx.insert(calendarEventParticipants).values(
        input.participants.map((p) => ({
          organizationId,
          calendarEventId: created.id,
          membershipId: p.membershipId ?? null,
          displayName: p.displayName ?? null,
          email: p.email ?? null,
          roleLabel: p.roleLabel ?? null,
        })),
      );
    }

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "calendar_event.created",
      resourceType: "calendar_event",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { title: created.title, status: created.status },
    });

    return {
      event: serializeEvent(created),
      conflicts,
      conflictWarning:
        conflicts.length > 0
          ? "Há sobreposição de horário com outro compromisso do responsável (aviso, não bloqueio)."
          : null,
    };
  });
}

export async function updateCalendarEvent(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  eventId: string,
  input: {
    title?: string;
    description?: string | null;
    eventType?: typeof calendarEvents.$inferInsert.eventType;
    startsAt?: string;
    endsAt?: string;
    timezone?: string;
    allDay?: boolean;
    locationType?: typeof calendarEvents.$inferInsert.locationType;
    locationText?: string | null;
    meetingUrl?: string | null;
    status?: CalendarEventStatus;
    recurrence?: typeof calendarEvents.$inferInsert.recurrence;
    legalMatterId?: string | null;
    judicialProcessId?: string | null;
    administrativeProcessId?: string | null;
    taskId?: string | null;
    responsibleMembershipId?: string | null;
  },
  meta: RequestMeta,
) {
  const actor = requireCalendarPermission(account, organizationId, "calendar.update");
  const existing = await requireEvent(db, organizationId, eventId);
  if (input.status) {
    assertCalendarEventTransition(existing.status as CalendarEventStatus, input.status);
  }
  const startsAt = input.startsAt ? new Date(input.startsAt) : existing.startsAt;
  const endsAt = input.endsAt ? new Date(input.endsAt) : existing.endsAt;
  const responsible =
    input.responsibleMembershipId === undefined
      ? existing.responsibleMembershipId
      : input.responsibleMembershipId;
  const conflicts = await detectConflicts(db, organizationId, {
    startsAt,
    endsAt,
    responsibleMembershipId: responsible,
    excludeEventId: eventId,
  });

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(calendarEvents)
      .set({
        title: input.title ?? existing.title,
        description: input.description === undefined ? existing.description : input.description,
        eventType: input.eventType ?? existing.eventType,
        startsAt,
        endsAt,
        timezone: input.timezone ?? existing.timezone,
        allDay: input.allDay ?? existing.allDay,
        locationType: input.locationType ?? existing.locationType,
        locationText: input.locationText === undefined ? existing.locationText : input.locationText,
        meetingUrl: input.meetingUrl === undefined ? existing.meetingUrl : input.meetingUrl,
        status: input.status ?? existing.status,
        recurrence: input.recurrence ?? existing.recurrence,
        legalMatterId:
          input.legalMatterId === undefined ? existing.legalMatterId : input.legalMatterId,
        judicialProcessId:
          input.judicialProcessId === undefined
            ? existing.judicialProcessId
            : input.judicialProcessId,
        administrativeProcessId:
          input.administrativeProcessId === undefined
            ? existing.administrativeProcessId
            : input.administrativeProcessId,
        taskId: input.taskId === undefined ? existing.taskId : input.taskId,
        responsibleMembershipId: responsible,
        updatedAt: new Date(),
      })
      .where(eq(calendarEvents.id, eventId))
      .returning();
    if (!updated) throw new AppError("INTERNAL_ERROR", "Não foi possível atualizar o compromisso.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "calendar_event.updated",
      resourceType: "calendar_event",
      resourceId: eventId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: updated.status, actorMembershipId: actor.membershipId },
    });
    return {
      event: serializeEvent(updated),
      conflicts,
      conflictWarning:
        conflicts.length > 0
          ? "Há sobreposição de horário com outro compromisso do responsável (aviso, não bloqueio)."
          : null,
    };
  });
}

export async function rescheduleCalendarEvent(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  eventId: string,
  input: { startsAt: string; endsAt: string; timezone?: string; reason?: string },
  meta: RequestMeta,
) {
  return updateCalendarEvent(
    db,
    account,
    organizationId,
    eventId,
    {
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone,
      status: "rescheduled",
    },
    meta,
  );
}

export async function cancelCalendarEvent(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  eventId: string,
  meta: RequestMeta,
) {
  requireCalendarPermission(account, organizationId, "calendar.delete");
  return updateCalendarEvent(db, account, organizationId, eventId, { status: "cancelled" }, meta);
}

/** Projeta audiência judicial em CalendarEvent (SSOT via judicialHearingId). */
export async function linkHearingToCalendar(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  judicialHearingId: string,
  meta: RequestMeta,
) {
  const actor = requireCalendarPermission(account, organizationId, "calendar.create");
  const hearing = await db.query.judicialHearings.findFirst({
    where: and(
      eq(judicialHearings.id, judicialHearingId),
      eq(judicialHearings.organizationId, organizationId),
    ),
  });
  if (!hearing) throw new AppError("NOT_FOUND", "Não encontramos esta audiência no seu acesso.");

  const existing = await db.query.calendarEvents.findFirst({
    where: and(
      eq(calendarEvents.organizationId, organizationId),
      eq(calendarEvents.judicialHearingId, judicialHearingId),
    ),
  });
  if (existing) {
    return {
      event: serializeEvent(existing),
      created: false,
      note: "Evento já projetado a partir da audiência (SSOT).",
    };
  }

  const endsAt = new Date(hearing.scheduledAt.getTime() + 60 * 60_000);
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(calendarEvents)
      .values({
        organizationId,
        title: `Audiência: ${hearing.type}`,
        description: hearing.notes,
        eventType: "hearing",
        startsAt: hearing.scheduledAt,
        endsAt,
        timezone: "America/Sao_Paulo",
        locationType: hearing.locationType ?? "undetermined",
        locationText: hearing.locationText,
        status:
          hearing.status === "cancelled"
            ? "cancelled"
            : hearing.status === "confirmed"
              ? "confirmed"
              : "scheduled",
        judicialProcessId: hearing.judicialProcessId,
        judicialHearingId: hearing.id,
        createdByMembershipId: actor.membershipId,
      })
      .returning();
    if (!created) throw new AppError("INTERNAL_ERROR", "Não foi possível projetar a audiência.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "calendar_event.hearing_linked",
      resourceType: "calendar_event",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { judicialHearingId },
    });
    return {
      event: serializeEvent(created),
      created: true,
      note: "Projeção da audiência judicial — hearing permanece SSOT.",
    };
  });
}

export async function addParticipant(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  eventId: string,
  input: {
    membershipId?: string;
    displayName?: string;
    email?: string;
    roleLabel?: string;
  },
  meta: RequestMeta,
) {
  requireCalendarPermission(account, organizationId, "calendar.update");
  await requireEvent(db, organizationId, eventId);
  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(calendarEventParticipants)
      .values({
        organizationId,
        calendarEventId: eventId,
        membershipId: input.membershipId ?? null,
        displayName: input.displayName ?? null,
        email: input.email ?? null,
        roleLabel: input.roleLabel ?? null,
      })
      .returning();
    if (!created)
      throw new AppError("INTERNAL_ERROR", "Não foi possível adicionar o participante.");
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "calendar_event.participant_added",
      resourceType: "calendar_event_participant",
      resourceId: created.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
    return {
      id: created.id,
      membershipId: created.membershipId,
      displayName: created.displayName,
      email: created.email,
      roleLabel: created.roleLabel,
    };
  });
}

export async function countCalendarOverview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  requireCalendarPermission(account, organizationId, "calendar.read");
  const now = new Date();
  const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
  const [upcoming] = await db
    .select({ value: count() })
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.organizationId, organizationId),
        gte(calendarEvents.startsAt, now),
        lte(calendarEvents.startsAt, weekAhead),
        or(
          eq(calendarEvents.status, "scheduled"),
          eq(calendarEvents.status, "confirmed"),
          eq(calendarEvents.status, "rescheduled"),
        ),
      ),
    );
  return { upcomingWeek: upcoming?.value ?? 0, externalSync: "NOT_CONFIGURED" as const };
}
