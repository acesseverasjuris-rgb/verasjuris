import type { PaymentProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import { policyDiligence, type SessionAccount } from "@verasjuris/auth";
import {
  diligenceAssignments,
  diligenceEvidence,
  diligenceExecutionEvents,
  diligenceProposals,
  diligenceRequests,
  diligenceTypes,
  isUniqueViolation,
  marketplaceDisputes,
  serviceReviews,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";

export type DiligenceModuleDeps = {
  paymentProvider: PaymentProvider;
};

const SYSTEM_DILIGENCE_TYPES = [
  { key: "hearing_attendance", name: "Comparecimento em audiência", sortOrder: 10 },
  { key: "protocol_filing", name: "Protocolo de petição", sortOrder: 20 },
  { key: "document_copy", name: "Cópia de autos", sortOrder: 30 },
  { key: "registry_visit", name: "Visita a cartório/vara", sortOrder: 40 },
] as const;

export async function ensureDiligenceTypesCatalog(db: AppDatabase) {
  for (const item of SYSTEM_DILIGENCE_TYPES) {
    const [existing] = await db
      .select({ id: diligenceTypes.id })
      .from(diligenceTypes)
      .where(eq(diligenceTypes.key, item.key))
      .limit(1);
    if (!existing) {
      await db.insert(diligenceTypes).values({
        key: item.key,
        name: item.name,
        sortOrder: item.sortOrder,
        isSystem: true,
        active: true,
      });
    }
  }
}

export async function listDiligenceTypes(db: AppDatabase) {
  await ensureDiligenceTypesCatalog(db);
  const rows = await db.select().from(diligenceTypes).where(eq(diligenceTypes.active, true));
  return { types: rows };
}

function serializeRequest(row: typeof diligenceRequests.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    description: row.description,
    status: row.status,
    typeId: row.typeId,
    dueAt: iso(row.dueAt),
    urgency: row.urgency,
    budgetCents: row.budgetCents,
    acceptedProposalId: row.acceptedProposalId,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function getTypeByKey(db: AppDatabase, typeKey: string) {
  await ensureDiligenceTypesCatalog(db);
  const [type] = await db
    .select()
    .from(diligenceTypes)
    .where(eq(diligenceTypes.key, typeKey))
    .limit(1);
  if (!type) throw new AppError("NOT_FOUND", "Tipo de diligência não encontrado.");
  return type;
}

async function getRequestInOrg(db: AppDatabase, organizationId: string, requestId: string) {
  const [row] = await db
    .select()
    .from(diligenceRequests)
    .where(
      and(
        eq(diligenceRequests.id, requestId),
        eq(diligenceRequests.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Solicitação de diligência não encontrada.");
  return row;
}

export async function listDiligenceRequests(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (access) => policyDiligence(access, "diligence.read"));
  const rows = await db
    .select()
    .from(diligenceRequests)
    .where(eq(diligenceRequests.organizationId, organizationId))
    .orderBy(desc(diligenceRequests.createdAt));
  return { requests: rows.map(serializeRequest) };
}

export async function createDiligenceRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    typeKey: string;
    title: string;
    description: string;
    clientId?: string;
    legalMatterId?: string;
    state?: string;
    city?: string;
    addressText?: string;
    courtOrAgency?: string;
    dueAt?: string;
    urgency?: string;
    budgetCents?: number;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyDiligence(access, "diligence.create"),
  );
  const type = await getTypeByKey(db, input.typeKey);
  const [row] = await db
    .insert(diligenceRequests)
    .values({
      organizationId,
      requesterMembershipId: membership.membershipId,
      typeId: type.id,
      title: input.title,
      description: input.description,
      clientId: input.clientId ?? null,
      legalMatterId: input.legalMatterId ?? null,
      state: input.state ?? null,
      city: input.city ?? null,
      addressText: input.addressText ?? null,
      courtOrAgency: input.courtOrAgency ?? null,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      urgency: input.urgency ?? "normal",
      budgetCents: input.budgetCents ?? null,
      status: "draft",
    })
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "diligence.request.create",
    resourceType: "diligence_request",
    resourceId: row!.id,
    requestId: meta.requestId,
  });
  return { request: serializeRequest(row!) };
}

export async function publishDiligenceRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyDiligence(access, "diligence.create"),
  );
  const existing = await getRequestInOrg(db, organizationId, requestId);
  if (existing.status !== "draft") {
    throw new AppError("VALIDATION_ERROR", "A solicitação já foi publicada.");
  }
  const [row] = await db
    .update(diligenceRequests)
    .set({ status: "receiving_proposals", updatedAt: new Date() })
    .where(eq(diligenceRequests.id, requestId))
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "diligence.request.publish",
    resourceType: "diligence_request",
    resourceId: requestId,
    requestId: meta.requestId,
  });
  return { request: serializeRequest(row!) };
}

export async function createDiligenceProposal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    requestId: string;
    amountCents: number;
    estimatedCompletionAt?: string;
    notes?: string;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyDiligence(access, "diligence.propose"),
  );
  const request = await getRequestInOrg(db, organizationId, input.requestId);
  if (request.status !== "receiving_proposals" && request.status !== "open") {
    throw new AppError("VALIDATION_ERROR", "Esta solicitação não está recebendo propostas.");
  }
  const [row] = await db
    .insert(diligenceProposals)
    .values({
      requestId: input.requestId,
      professionalProfileId: account.user.id,
      amountCents: input.amountCents,
      estimatedCompletionAt: input.estimatedCompletionAt
        ? new Date(input.estimatedCompletionAt)
        : null,
      notes: input.notes ?? null,
      status: "submitted",
    })
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "diligence.proposal.create",
    resourceType: "diligence_proposal",
    resourceId: row!.id,
    requestId: meta.requestId,
  });
  return { proposal: row };
}

export async function acceptDiligenceProposal(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  proposalId: string,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyDiligence(access, "diligence.assign"),
  );
  const request = await getRequestInOrg(db, organizationId, requestId);
  if (request.status === "assigned" || request.acceptedProposalId) {
    throw new AppError("CONFLICT", "Esta solicitação já possui proposta aceita.");
  }
  const [proposal] = await db
    .select()
    .from(diligenceProposals)
    .where(and(eq(diligenceProposals.id, proposalId), eq(diligenceProposals.requestId, requestId)))
    .limit(1);
  if (!proposal) throw new AppError("NOT_FOUND", "Proposta não encontrada.");
  if (proposal.status !== "submitted") {
    throw new AppError("VALIDATION_ERROR", "Esta proposta não pode ser aceita.");
  }
  try {
    await db.transaction(async (tx) => {
      await tx.insert(diligenceAssignments).values({
        requestId,
        proposalId,
        correspondentProfileId: proposal.professionalProfileId,
        status: "accepted",
      });
      await tx
        .update(diligenceRequests)
        .set({
          status: "assigned",
          acceptedProposalId: proposalId,
          updatedAt: new Date(),
        })
        .where(eq(diligenceRequests.id, requestId));
      await tx
        .update(diligenceProposals)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(diligenceProposals.id, proposalId));
      const otherProposals = await tx
        .select({ id: diligenceProposals.id })
        .from(diligenceProposals)
        .where(
          and(
            eq(diligenceProposals.requestId, requestId),
            eq(diligenceProposals.status, "submitted"),
          ),
        );
      for (const item of otherProposals) {
        if (item.id === proposalId) continue;
        await tx
          .update(diligenceProposals)
          .set({ status: "declined", updatedAt: new Date() })
          .where(eq(diligenceProposals.id, item.id));
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("CONFLICT", "Outra proposta já foi aceita para esta solicitação.");
    }
    throw error;
  }
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "diligence.proposal.accept",
    resourceType: "diligence_request",
    resourceId: requestId,
    metadata: { proposalId },
    requestId: meta.requestId,
  });
  return { requestId, proposalId, status: "assigned" };
}

async function getAssignmentForRequest(db: AppDatabase, requestId: string) {
  const [assignment] = await db
    .select()
    .from(diligenceAssignments)
    .where(eq(diligenceAssignments.requestId, requestId))
    .limit(1);
  if (!assignment) throw new AppError("NOT_FOUND", "Atribuição não encontrada.");
  return assignment;
}

export async function addDiligenceExecutionEvent(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  input: {
    eventType: (typeof diligenceExecutionEvents.$inferSelect)["eventType"];
    notes?: string;
    occurredAt?: string;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyDiligence(access, "diligence.execute"),
  );
  await getRequestInOrg(db, organizationId, requestId);
  const assignment = await getAssignmentForRequest(db, requestId);
  const [event] = await db
    .insert(diligenceExecutionEvents)
    .values({
      assignmentId: assignment.id,
      eventType: input.eventType,
      notes: input.notes ?? null,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      createdByUserId: account.user.id,
    })
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "diligence.execution.event",
    resourceType: "diligence_execution_event",
    resourceId: event!.id,
    requestId: meta.requestId,
  });
  return { event };
}

export async function submitDiligenceEvidence(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  input: {
    evidenceType: (typeof diligenceEvidence.$inferSelect)["evidenceType"];
    documentId?: string;
    description?: string;
    occurredAt?: string;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyDiligence(access, "diligence.execute"),
  );
  await getRequestInOrg(db, organizationId, requestId);
  const assignment = await getAssignmentForRequest(db, requestId);
  const [row] = await db
    .insert(diligenceEvidence)
    .values({
      assignmentId: assignment.id,
      evidenceType: input.evidenceType,
      documentId: input.documentId ?? null,
      description: input.description ?? null,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
      authenticityClaim: "unverified",
      status: "submitted",
    })
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "diligence.evidence.submit",
    resourceType: "diligence_evidence",
    resourceId: row!.id,
    metadata: { authenticityClaim: "unverified" },
    requestId: meta.requestId,
  });
  return { evidence: row };
}

export async function reviewDiligenceEvidence(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  evidenceId: string,
  input: { status: "accepted" | "rejected"; notes?: string },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyDiligence(access, "diligence.review_evidence"),
  );
  const [existing] = await db
    .select()
    .from(diligenceEvidence)
    .where(eq(diligenceEvidence.id, evidenceId))
    .limit(1);
  if (!existing) throw new AppError("NOT_FOUND", "Evidência não encontrada.");
  const [row] = await db
    .update(diligenceEvidence)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(diligenceEvidence.id, evidenceId))
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "diligence.evidence.review",
    resourceType: "diligence_evidence",
    resourceId: evidenceId,
    metadata: { status: input.status },
    requestId: meta.requestId,
  });
  return { evidence: row };
}

export async function completeDiligenceAssignment(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  moduleDeps: DiligenceModuleDeps,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyDiligence(access, "diligence.complete"),
  );
  await getRequestInOrg(db, organizationId, requestId);
  const assignment = await getAssignmentForRequest(db, requestId);
  // Pagamento externo: NOT_CONFIGURED por padrão — conclusão não simula liquidação.
  await db.transaction(async (tx) => {
    await tx
      .update(diligenceAssignments)
      .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(diligenceAssignments.id, assignment.id));
    await tx
      .update(diligenceRequests)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(diligenceRequests.id, requestId));
  });
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "diligence.assignment.complete",
    resourceType: "diligence_assignment",
    resourceId: assignment.id,
    requestId: meta.requestId,
  });
  return { requestId, status: "completed" };
}

export async function openDiligenceDispute(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  input: { reasonCode: string; description: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) => policyDiligence(access, "diligence.read"));
  const request = await getRequestInOrg(db, organizationId, requestId);
  const assignment = await getAssignmentForRequest(db, requestId);
  const [dispute] = await db
    .insert(marketplaceDisputes)
    .values({
      engagementId: null,
      sourceType: "diligence",
      sourceEntityType: "diligence_assignment",
      sourceEntityId: assignment.id,
      openedByUserId: account.user.id,
      reasonCode: input.reasonCode,
      description: input.description,
      status: "open",
    })
    .returning();
  if (!dispute) throw new AppError("INTERNAL_ERROR", "Não foi possível abrir a disputa.");
  await db
    .update(diligenceRequests)
    .set({ status: "disputed", updatedAt: new Date() })
    .where(eq(diligenceRequests.id, request.id));
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "diligence.dispute_opened",
    resourceType: "marketplace_dispute",
    resourceId: dispute.id,
    requestId: meta.requestId,
  });
  return { dispute };
}

export async function createDiligenceReview(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  input: { rating: number; comment?: string },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyDiligence(access, "diligence.read"),
  );
  const request = await getRequestInOrg(db, organizationId, requestId);
  if (request.status !== "completed") {
    throw new AppError("VALIDATION_ERROR", "Avaliação permitida apenas após conclusão.");
  }
  const assignment = await getAssignmentForRequest(db, requestId);
  const [review] = await db
    .insert(serviceReviews)
    .values({
      origin: "diligence",
      sourceEntityType: "diligence_assignment",
      sourceEntityId: assignment.id,
      reviewerUserId: account.user.id,
      professionalProfileId: assignment.correspondentProfileId,
      rating: input.rating,
      comment: input.comment ?? null,
      status: "pending",
    })
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "diligence.review.create",
    resourceType: "service_review",
    resourceId: review!.id,
    requestId: meta.requestId,
  });
  return { review };
}
