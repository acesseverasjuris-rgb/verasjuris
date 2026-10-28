import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");
const optionalUuid = uuid.optional();
const nullableUuid = uuid.nullable().optional();
const datetime = z.string().datetime({ offset: true });
const optionalDatetime = datetime.optional();
const nullableDatetime = datetime.nullable().optional();
const cents = z
  .number()
  .int("Informe um valor inteiro em centavos.")
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);

export const CLIENT_DOCUMENT_REQUEST_STATUSES = [
  "open",
  "viewed",
  "uploaded",
  "under_review",
  "accepted",
  "rejected",
  "cancelled",
] as const;

export const CLIENT_REQUEST_TYPES = [
  "document_request",
  "status_request",
  "appointment_request",
  "call_request",
  "contract_request",
  "payment_question",
  "general",
  "other",
] as const;

export const CLIENT_REQUEST_STATUSES = [
  "open",
  "in_review",
  "assigned",
  "waiting_client",
  "resolved",
  "closed",
  "cancelled",
] as const;

export const CLIENT_APPOINTMENT_REQUEST_STATUSES = [
  "open",
  "in_review",
  "scheduled",
  "declined",
  "cancelled",
] as const;

export const CONVERSATION_THREAD_STATUSES = [
  "open",
  "waiting_client",
  "waiting_staff",
  "closed",
  "archived",
] as const;

export const MESSAGE_SENDER_TYPES = ["client", "staff", "system"] as const;

export const CLIENT_PAYMENT_STATUSES = [
  "pending",
  "paid",
  "partial",
  "overdue",
  "cancelled",
  "refunded",
  "disputed",
] as const;

const preferredDateRangeSchema = z.object({
  start: datetime,
  end: datetime,
});

export const linkOrganizationClientUserSchema = z.object({
  userId: uuid,
  crmClientId: uuid,
});

export const createClientDocumentRequestSchema = z.object({
  clientId: uuid,
  legalMatterId: optionalUuid,
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(4000).optional(),
  documentKind: z.string().trim().max(80).optional(),
  dueAt: optionalDatetime,
  status: z.enum(CLIENT_DOCUMENT_REQUEST_STATUSES).default("open"),
});

export const updateClientDocumentRequestSchema = z
  .object({
    title: z.string().trim().min(2).max(300).optional(),
    description: z.string().trim().max(4000).nullable().optional(),
    documentKind: z.string().trim().max(80).nullable().optional(),
    dueAt: nullableDatetime,
    status: z.enum(CLIENT_DOCUMENT_REQUEST_STATUSES).optional(),
    fulfilledDocumentId: nullableUuid,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createClientRequestSchema = z.object({
  clientId: uuid,
  legalMatterId: optionalUuid,
  requestType: z.enum(CLIENT_REQUEST_TYPES).default("general"),
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(8000).optional(),
});

export const updateClientRequestSchema = z
  .object({
    requestType: z.enum(CLIENT_REQUEST_TYPES).optional(),
    title: z.string().trim().min(2).max(300).optional(),
    description: z.string().trim().max(8000).nullable().optional(),
    status: z.enum(CLIENT_REQUEST_STATUSES).optional(),
    assignedMembershipId: nullableUuid,
    resultingTaskId: nullableUuid,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createClientAppointmentRequestSchema = z.object({
  clientId: uuid,
  legalMatterId: optionalUuid,
  preferredDateRanges: z.array(preferredDateRangeSchema).max(10).optional(),
  appointmentType: z.string().trim().min(1).max(80).default("general"),
  notes: z.string().trim().max(4000).optional(),
});

export const updateClientAppointmentRequestSchema = z
  .object({
    preferredDateRanges: z.array(preferredDateRangeSchema).max(10).nullable().optional(),
    appointmentType: z.string().trim().min(1).max(80).optional(),
    notes: z.string().trim().max(4000).nullable().optional(),
    status: z.enum(CLIENT_APPOINTMENT_REQUEST_STATUSES).optional(),
    resultingCalendarEventId: nullableUuid,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createConversationThreadSchema = z.object({
  clientId: optionalUuid,
  legalMatterId: optionalUuid,
  subject: z.string().trim().min(2).max(300),
  status: z.enum(CONVERSATION_THREAD_STATUSES).default("open"),
  contextType: z.string().trim().max(80).optional(),
  contextId: optionalUuid,
});

export const updateConversationThreadSchema = z
  .object({
    subject: z.string().trim().min(2).max(300).optional(),
    status: z.enum(CONVERSATION_THREAD_STATUSES).optional(),
    clientId: nullableUuid,
    legalMatterId: nullableUuid,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const createConversationParticipantSchema = z.object({
  threadId: uuid,
  userId: uuid,
  participantRole: z.string().trim().min(1).max(40).default("member"),
});

export const createMessageSchema = z.object({
  threadId: uuid,
  body: z.string().trim().min(1).max(20_000),
  senderType: z.enum(MESSAGE_SENDER_TYPES).default("staff"),
  clientVisible: z.boolean().default(true),
});

export const updateMessageSchema = z.object({
  body: z.string().trim().min(1).max(20_000),
});

export const createClientPaymentRecordSchema = z.object({
  clientId: uuid,
  legalMatterId: optionalUuid,
  contractId: optionalUuid,
  description: z.string().trim().min(2).max(500),
  amountCents: cents,
  dueAt: optionalDatetime,
  status: z.enum(CLIENT_PAYMENT_STATUSES).default("pending"),
  paymentMethod: z.string().trim().max(80).optional(),
  externalReference: z.string().trim().max(200).optional(),
  source: z.string().trim().min(1).max(40).default("manual"),
  evidenceDocumentId: optionalUuid,
});

export const updateClientPaymentRecordSchema = z
  .object({
    description: z.string().trim().min(2).max(500).optional(),
    amountCents: cents.optional(),
    dueAt: nullableDatetime,
    paidAt: nullableDatetime,
    status: z.enum(CLIENT_PAYMENT_STATUSES).optional(),
    paymentMethod: z.string().trim().max(80).nullable().optional(),
    externalReference: z.string().trim().max(200).nullable().optional(),
    evidenceDocumentId: nullableUuid,
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Informe ao menos um campo." });

export const clientPortalListQuerySchema = z.object({
  clientId: optionalUuid,
  legalMatterId: optionalUuid,
  status: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});
