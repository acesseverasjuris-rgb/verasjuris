import { z } from "zod";

const uuidSchema = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuidSchema.optional();
const nullableUuid = uuidSchema.nullable().optional();
const datetime = z.string().datetime();

const ianaTimezone = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .default("America/Sao_Paulo")
  .refine((value) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Informe um fuso IANA válido (ex.: America/Sao_Paulo).");

/* ─── Tasks ─── */

const taskStatus = z.enum([
  "todo",
  "in_progress",
  "waiting",
  "blocked",
  "done",
  "cancelled",
  "archived",
]);
const taskPriority = z.enum(["low", "normal", "high", "urgent"]);
const dependencyType = z.enum(["blocks", "requires"]);

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(8000).optional(),
  status: taskStatus.optional(),
  priority: taskPriority.optional(),
  legalMatterId: optionalUuid,
  judicialProcessId: optionalUuid,
  administrativeProcessId: optionalUuid,
  parentTaskId: optionalUuid,
  responsibleMembershipId: optionalUuid,
  startAt: datetime.optional(),
  dueAt: datetime.optional(),
  slaPolicyId: optionalUuid,
});

export const updateTaskSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    status: taskStatus.optional(),
    priority: taskPriority.optional(),
    legalMatterId: nullableUuid,
    judicialProcessId: nullableUuid,
    administrativeProcessId: nullableUuid,
    parentTaskId: nullableUuid,
    responsibleMembershipId: nullableUuid,
    startAt: datetime.nullable().optional(),
    dueAt: datetime.nullable().optional(),
    slaPolicyId: nullableUuid,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const taskListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: taskStatus.optional(),
  priority: taskPriority.optional(),
  responsibleMembershipId: optionalUuid,
  legalMatterId: optionalUuid,
  judicialProcessId: optionalUuid,
  administrativeProcessId: optionalUuid,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createChecklistItemSchema = z.object({
  title: z.string().trim().min(1).max(300),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});

export const updateChecklistItemSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    completed: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createTaskCommentSchema = z.object({
  body: z.string().trim().min(1).max(8000),
});

export const createTaskDependencySchema = z.object({
  dependsOnTaskId: uuidSchema,
  dependencyType: dependencyType.optional(),
});

export const createSlaPolicySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  targetMinutes: z.number().int().min(1).max(10_000_000),
  warningMinutes: z.number().int().min(1).max(10_000_000).optional(),
  active: z.boolean().optional(),
});

/* ─── Calendar ─── */

const calendarEventType = z.enum([
  "hearing",
  "expert_exam",
  "meeting",
  "consultation",
  "oral_argument",
  "internal_event",
  "other",
]);
const calendarEventStatus = z.enum([
  "scheduled",
  "confirmed",
  "rescheduled",
  "completed",
  "cancelled",
]);
const locationType = z.enum(["in_person", "remote", "hybrid", "undetermined"]);
const recurrence = z.enum(["none", "daily", "weekly", "monthly"]);

export const createCalendarEventSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().max(8000).optional(),
    eventType: calendarEventType.optional(),
    startsAt: datetime,
    endsAt: datetime,
    timezone: ianaTimezone,
    allDay: z.boolean().optional(),
    locationType: locationType.optional(),
    locationText: z.string().trim().max(500).optional(),
    meetingUrl: z.string().trim().max(500).optional(),
    status: calendarEventStatus.optional(),
    recurrence: recurrence.optional(),
    legalMatterId: optionalUuid,
    judicialProcessId: optionalUuid,
    administrativeProcessId: optionalUuid,
    taskId: optionalUuid,
    judicialHearingId: optionalUuid,
    responsibleMembershipId: optionalUuid,
    participants: z
      .array(
        z.object({
          membershipId: optionalUuid,
          displayName: z.string().trim().max(160).optional(),
          email: z.string().trim().email().max(320).optional(),
          roleLabel: z.string().trim().max(80).optional(),
        }),
      )
      .max(50)
      .optional(),
  })
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    message: "O término deve ser posterior ao início.",
    path: ["endsAt"],
  });

export const updateCalendarEventSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    eventType: calendarEventType.optional(),
    startsAt: datetime.optional(),
    endsAt: datetime.optional(),
    timezone: ianaTimezone.optional(),
    allDay: z.boolean().optional(),
    locationType: locationType.optional(),
    locationText: z.string().trim().max(500).nullable().optional(),
    meetingUrl: z.string().trim().max(500).nullable().optional(),
    status: calendarEventStatus.optional(),
    recurrence: recurrence.optional(),
    legalMatterId: nullableUuid,
    judicialProcessId: nullableUuid,
    administrativeProcessId: nullableUuid,
    taskId: nullableUuid,
    responsibleMembershipId: nullableUuid,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const rescheduleCalendarEventSchema = z
  .object({
    startsAt: datetime,
    endsAt: datetime,
    timezone: ianaTimezone.optional(),
    reason: z.string().trim().max(1000).optional(),
  })
  .refine((value) => new Date(value.endsAt) > new Date(value.startsAt), {
    message: "O término deve ser posterior ao início.",
    path: ["endsAt"],
  });

export const linkHearingSchema = z.object({
  judicialHearingId: uuidSchema,
});

export const calendarListQuerySchema = z.object({
  from: datetime.optional(),
  to: datetime.optional(),
  status: calendarEventStatus.optional(),
  eventType: calendarEventType.optional(),
  responsibleMembershipId: optionalUuid,
  legalMatterId: optionalUuid,
  judicialProcessId: optionalUuid,
  view: z.enum(["day", "week", "month", "list"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const addCalendarParticipantSchema = z.object({
  membershipId: optionalUuid,
  displayName: z.string().trim().max(160).optional(),
  email: z.string().trim().email().max(320).optional(),
  roleLabel: z.string().trim().max(80).optional(),
});

/* ─── Deadlines ─── */

const deadlineStatus = z.enum([
  "draft",
  "suggested",
  "pending_confirmation",
  "confirmed",
  "completed",
  "cancelled",
]);
const deadlineSourceType = z.enum([
  "manual",
  "judicial_movement",
  "judicial_decision",
  "hearing",
  "administrative_requirement",
  "administrative_decision",
  "administrative_deadline",
  "contract",
  "other",
]);
const deadlineRuleType = z.enum(["manual_date", "calendar_days", "business_days", "custom"]);

export const createDeadlineSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().max(8000).optional(),
  baseDate: datetime,
  baseDateLabel: z.string().trim().max(200).optional(),
  ruleType: deadlineRuleType.optional(),
  ruleDescription: z.string().trim().max(2000).optional(),
  ruleDays: z.number().int().min(0).max(10_000).optional(),
  manualDueAt: datetime.optional(),
  timezone: ianaTimezone,
  sourceType: deadlineSourceType.optional(),
  sourceId: optionalUuid,
  legalMatterId: optionalUuid,
  judicialProcessId: optionalUuid,
  administrativeProcessId: optionalUuid,
  responsibleMembershipId: optionalUuid,
  status: z.enum(["draft", "suggested", "pending_confirmation"]).optional(),
  calculate: z.boolean().optional(),
});

export const updateDeadlineSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    baseDate: datetime.optional(),
    baseDateLabel: z.string().trim().max(200).nullable().optional(),
    ruleType: deadlineRuleType.optional(),
    ruleDescription: z.string().trim().max(2000).nullable().optional(),
    ruleDays: z.number().int().min(0).max(10_000).nullable().optional(),
    timezone: ianaTimezone.optional(),
    responsibleMembershipId: nullableUuid,
    legalMatterId: nullableUuid,
    judicialProcessId: nullableUuid,
    administrativeProcessId: nullableUuid,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const calculateDeadlineSchema = z.object({
  baseDate: datetime.optional(),
  ruleType: deadlineRuleType.optional(),
  ruleDays: z.number().int().min(0).max(10_000).optional(),
  manualDueAt: datetime.optional(),
  timezone: ianaTimezone.optional(),
});

export const confirmDeadlineSchema = z.object({
  confirmedDueAt: datetime.optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const changeDeadlineSchema = z.object({
  confirmedDueAt: datetime,
  reason: z.string().trim().min(3).max(2000),
});

export const deadlineListQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  status: deadlineStatus.optional(),
  sourceType: deadlineSourceType.optional(),
  responsibleMembershipId: optionalUuid,
  legalMatterId: optionalUuid,
  judicialProcessId: optionalUuid,
  administrativeProcessId: optionalUuid,
  from: datetime.optional(),
  to: datetime.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const createDeadlineAlertRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  offsetMinutes: z.number().int().min(-525_600).max(525_600),
  active: z.boolean().optional(),
});

export const createDeadlineEscalationRuleSchema = z.object({
  name: z.string().trim().min(1).max(120),
  offsetMinutes: z.number().int().min(-525_600).max(525_600),
  escalateToMembershipId: optionalUuid,
  escalateToRoleKey: z.string().trim().max(40).optional(),
  active: z.boolean().optional(),
});

/* ─── Dossier ─── */

const documentKind = z.enum([
  "identification",
  "evidence",
  "contract",
  "petition",
  "decision",
  "report",
  "power_of_attorney",
  "administrative",
  "correspondence",
  "other",
]);
const legalContext = z.enum([
  "client",
  "matter",
  "judicial",
  "administrative",
  "internal",
  "other",
]);
const evidentiaryRole = z.enum(["none", "evidence", "supporting", "rebuttal", "reference"]);

export const classifyDocumentSchema = z
  .object({
    documentKind: documentKind.optional(),
    legalContext: legalContext.optional(),
    evidentiaryRole: evidentiaryRole.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createDocumentLinkSchema = z.object({
  documentId: uuidSchema,
  linkType: z.string().trim().min(1).max(80),
  targetType: z.string().trim().min(1).max(80),
  targetId: uuidSchema,
});

export const dossierQuerySchema = z.object({
  documentKind: documentKind.optional(),
  legalContext: legalContext.optional(),
  evidentiaryRole: evidentiaryRole.optional(),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
