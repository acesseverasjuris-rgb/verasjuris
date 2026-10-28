import type {
  BiometricVerificationProvider,
  CPFVerificationProvider,
  DocumentVerificationProvider,
  OABVerificationProvider,
} from "@verasjuris/ai";
import { isValidCpfChecksum, maskCpf } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyProfessionalVerification,
  policyProfessionalVerificationProviderVerified,
  policyProfessionalVerificationReviewDecision,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  biometricVerificationSessions,
  lawyerProfiles,
  professionalIdentityDocuments,
  professionalRevalidationRequests,
  professionalSuspensions,
  professionalVerificationCases,
  professionalVerificationReviews,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import { assertCanReadDocument, requireDocumentInOrg } from "../documents/service.js";

export type ProfessionalVerificationModuleDeps = {
  oabVerificationProvider: OABVerificationProvider;
  cpfVerificationProvider: CPFVerificationProvider;
  documentVerificationProvider: DocumentVerificationProvider;
  biometricVerificationProvider: BiometricVerificationProvider;
};

function serializeCase(row: typeof professionalVerificationCases.$inferSelect) {
  const meta = row.subjectMetadata ?? {};
  const masked: Record<string, unknown> = { ...meta };
  if (typeof meta.cpf === "string") masked.cpf = maskCpf(String(meta.cpf));
  if (typeof meta.cpfDigits === "string") masked.cpfDigits = maskCpf(String(meta.cpfDigits));
  return {
    id: row.id,
    userId: row.userId,
    professionalProfileId: row.professionalProfileId,
    verificationType: row.verificationType,
    status: row.status,
    riskLevel: row.riskLevel,
    providerKey: row.providerKey,
    providerStatus: row.providerStatus,
    externalReference: row.externalReference,
    subjectMetadata: masked,
    requestedAt: iso(row.requestedAt),
    submittedAt: iso(row.submittedAt),
    reviewedAt: iso(row.reviewedAt),
    approvedAt: iso(row.approvedAt),
    expiresAt: iso(row.expiresAt),
    suspendedAt: iso(row.suspendedAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function requireLawyerProfile(db: AppDatabase, userId: string) {
  const [profile] = await db
    .select()
    .from(lawyerProfiles)
    .where(eq(lawyerProfiles.userId, userId))
    .limit(1);
  if (!profile) {
    throw new AppError("NOT_FOUND", "Perfil profissional não encontrado.");
  }
  return profile;
}

async function getCaseOrThrow(db: AppDatabase, caseId: string) {
  const [row] = await db
    .select()
    .from(professionalVerificationCases)
    .where(eq(professionalVerificationCases.id, caseId))
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Caso de verificação não encontrado.");
  return row;
}

export async function getProfessionalVerificationProvidersStatus(
  deps: ProfessionalVerificationModuleDeps,
) {
  const [oab, cpf, document, biometric] = await Promise.all([
    deps.oabVerificationProvider.healthCheck(),
    deps.cpfVerificationProvider.healthCheck(),
    deps.documentVerificationProvider.healthCheck(),
    deps.biometricVerificationProvider.healthCheck(),
  ]);
  return { oab, cpf, document, biometric };
}

export async function listOwnProfessionalVerificationCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (access) =>
    policyProfessionalVerification(access, "professional_verification.read_own"),
  );
  const rows = await db
    .select()
    .from(professionalVerificationCases)
    .where(eq(professionalVerificationCases.userId, account.user.id))
    .orderBy(desc(professionalVerificationCases.createdAt));
  return { cases: rows.map((row) => serializeCase(row)) };
}

export async function listOrgProfessionalVerificationCases(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (access) =>
    policyProfessionalVerification(access, "professional_verification.review"),
  );
  const rows = await db
    .select()
    .from(professionalVerificationCases)
    .orderBy(desc(professionalVerificationCases.createdAt))
    .limit(200);
  return { cases: rows.map((row) => serializeCase(row)) };
}

export async function createProfessionalVerificationCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    verificationType: (typeof professionalVerificationCases.$inferSelect)["verificationType"];
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyProfessionalVerification(access, "professional_verification.submit"),
  );
  const profile = await requireLawyerProfile(db, account.user.id);
  const [row] = await db
    .insert(professionalVerificationCases)
    .values({
      userId: account.user.id,
      professionalProfileId: profile.userId,
      verificationType: input.verificationType,
      status: "pending",
      requestedAt: new Date(),
    })
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "professional_verification.case.create",
    resourceType: "professional_verification_case",
    resourceId: row!.id,
    metadata: { verificationType: input.verificationType },
    requestId: meta.requestId,
  });
  return { case: serializeCase(row!) };
}

export async function submitProfessionalCpf(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  caseId: string,
  input: { cpf: string; fullName?: string },
  moduleDeps: ProfessionalVerificationModuleDeps,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyProfessionalVerification(access, "professional_verification.submit"),
  );
  const row = await getCaseOrThrow(db, caseId);
  if (row.userId !== account.user.id) {
    throw new AppError("NOT_FOUND", "Caso de verificação não encontrado.");
  }
  if (row.verificationType !== "cpf") {
    throw new AppError("VALIDATION_ERROR", "Este caso não é de verificação de CPF.");
  }
  const digits = input.cpf.replace(/\D/g, "");
  if (!isValidCpfChecksum(digits)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "CPF com dígitos inválidos. Isso não confirma identidade.",
    );
  }
  let identityVerified = false;
  let providerKey = moduleDeps.cpfVerificationProvider.key;
  let providerStatus = moduleDeps.cpfVerificationProvider.status;
  try {
    const result = await moduleDeps.cpfVerificationProvider.verify({
      cpfDigits: digits,
      fullName: input.fullName,
    });
    identityVerified = result.verified === true;
    providerKey = result.providerKey;
  } catch (error) {
    if (error instanceof AppError && error.code === "CPF_VERIFICATION_PROVIDER_NOT_CONFIGURED") {
      providerStatus = "not_configured";
    } else {
      throw error;
    }
  }
  const nextStatus = identityVerified ? "in_review" : "pending";
  const [updated] = await db
    .update(professionalVerificationCases)
    .set({
      status: nextStatus,
      providerKey,
      providerStatus,
      subjectMetadata: {
        cpfMasked: maskCpf(digits),
        formatValid: true,
        identityVerified,
        fullName: input.fullName ?? null,
      },
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(professionalVerificationCases.id, caseId))
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "professional_verification.cpf.submit",
    resourceType: "professional_verification_case",
    resourceId: caseId,
    metadata: { cpfMasked: maskCpf(digits), formatValid: true, identityVerified },
    requestId: meta.requestId,
  });
  return {
    case: serializeCase(updated!),
    disclaimer:
      "Validação de formato não prova identidade. Verificação de bureau exige provedor configurado.",
  };
}

export async function submitProfessionalOab(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  caseId: string,
  input: { oabNumber: string; oabUf: string },
  moduleDeps: ProfessionalVerificationModuleDeps,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyProfessionalVerification(access, "professional_verification.submit"),
  );
  const row = await getCaseOrThrow(db, caseId);
  if (row.userId !== account.user.id) {
    throw new AppError("NOT_FOUND", "Caso de verificação não encontrado.");
  }
  if (row.verificationType !== "oab") {
    throw new AppError("VALIDATION_ERROR", "Este caso não é de verificação OAB.");
  }
  let providerVerified = false;
  let providerKey = moduleDeps.oabVerificationProvider.id;
  let providerStatus =
    moduleDeps.oabVerificationProvider.id === "not_configured" ? "not_configured" : "configured";
  const externalReference: string | null = null;
  try {
    const result = await moduleDeps.oabVerificationProvider.verify({
      oabNumber: input.oabNumber,
      oabUf: input.oabUf,
    });
    providerVerified = result.verified === true;
    providerKey = result.providerKey;
  } catch (error) {
    if (error instanceof AppError && error.code === "OAB_VERIFICATION_PROVIDER_NOT_CONFIGURED") {
      providerStatus = "not_configured";
    } else {
      throw error;
    }
  }
  const informedOnly = !providerVerified;
  const [updated] = await db
    .update(professionalVerificationCases)
    .set({
      status: providerVerified ? "in_review" : "pending",
      providerKey,
      providerStatus,
      externalReference,
      subjectMetadata: {
        oabNumber: input.oabNumber,
        oabUf: input.oabUf,
        informedOnly,
        providerVerified,
      },
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(professionalVerificationCases.id, caseId))
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "professional_verification.oab.submit",
    resourceType: "professional_verification_case",
    resourceId: caseId,
    metadata: { oabUf: input.oabUf, informedOnly, providerVerified },
    requestId: meta.requestId,
  });
  return {
    case: serializeCase(updated!),
    informedOnly,
    disclaimer: "OAB informada não equivale a verificada sem resposta positiva do provedor.",
  };
}

export async function submitProfessionalIdentityDocument(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  caseId: string,
  input: {
    documentType: string;
    documentId: string;
    number?: string;
    issuingCountry?: string;
  },
  moduleDeps: ProfessionalVerificationModuleDeps,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyProfessionalVerification(access, "professional_verification.submit"),
  );
  const row = await getCaseOrThrow(db, caseId);
  if (row.userId !== account.user.id) {
    throw new AppError("NOT_FOUND", "Caso de verificação não encontrado.");
  }
  const doc = await requireDocumentInOrg(db, organizationId, input.documentId);
  await assertCanReadDocument(db, account, organizationId, doc);
  const numberMasked = input.number
    ? maskCpf(input.number.replace(/\D/g, "").padStart(11, "0"))
    : null;
  const [docRow] = await db
    .insert(professionalIdentityDocuments)
    .values({
      verificationCaseId: caseId,
      documentType: input.documentType,
      issuingCountry: input.issuingCountry ?? "BR",
      numberMasked,
      documentId: input.documentId,
      status: "pending_validation",
    })
    .returning();
  let docProviderStatus = moduleDeps.documentVerificationProvider.status;
  try {
    await moduleDeps.documentVerificationProvider.validateDocument({
      documentType: input.documentType,
      documentId: input.documentId,
    });
  } catch (error) {
    if (
      error instanceof AppError &&
      error.code === "DOCUMENT_VERIFICATION_PROVIDER_NOT_CONFIGURED"
    ) {
      docProviderStatus = "not_configured";
    } else {
      throw error;
    }
  }
  await db
    .update(professionalVerificationCases)
    .set({
      status: "in_review",
      providerStatus: docProviderStatus,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(professionalVerificationCases.id, caseId));
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "professional_verification.document.submit",
    resourceType: "professional_identity_document",
    resourceId: docRow!.id,
    metadata: { documentType: input.documentType, providerStatus: docProviderStatus },
    requestId: meta.requestId,
  });
  return { documentId: docRow!.id, providerStatus: docProviderStatus };
}

export async function recordBiometricConsent(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  caseId: string,
  input: { consentTermVersion: string },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyProfessionalVerification(access, "professional_verification.submit"),
  );
  const row = await getCaseOrThrow(db, caseId);
  if (row.userId !== account.user.id) {
    throw new AppError("NOT_FOUND", "Caso de verificação não encontrado.");
  }
  const [session] = await db
    .insert(biometricVerificationSessions)
    .values({
      verificationCaseId: caseId,
      consentRecordedAt: new Date(),
      consentTermVersion: input.consentTermVersion,
      status: "not_configured",
    })
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "professional_verification.biometric.consent",
    resourceType: "biometric_verification_session",
    resourceId: session!.id,
    metadata: { consentTermVersion: input.consentTermVersion },
    requestId: meta.requestId,
  });
  return { sessionId: session!.id };
}

export async function startBiometricSession(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  caseId: string,
  sessionId: string,
  moduleDeps: ProfessionalVerificationModuleDeps,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyProfessionalVerification(access, "professional_verification.submit"),
  );
  const row = await getCaseOrThrow(db, caseId);
  if (row.userId !== account.user.id) {
    throw new AppError("NOT_FOUND", "Caso de verificação não encontrado.");
  }
  const [session] = await db
    .select()
    .from(biometricVerificationSessions)
    .where(
      and(
        eq(biometricVerificationSessions.id, sessionId),
        eq(biometricVerificationSessions.verificationCaseId, caseId),
      ),
    )
    .limit(1);
  if (!session?.consentRecordedAt) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Registre o consentimento antes de iniciar a biometria.",
    );
  }
  if (moduleDeps.biometricVerificationProvider.status === "not_configured") {
    await db
      .update(biometricVerificationSessions)
      .set({ status: "not_configured", updatedAt: new Date() })
      .where(eq(biometricVerificationSessions.id, sessionId));
    throw new AppError(
      "NOT_CONFIGURED",
      "Nenhum provedor biométrico está configurado. Biometria não pode ser simulada.",
    );
  }
  const result = await moduleDeps.biometricVerificationProvider.createSession({
    verificationCaseId: caseId,
    consentTermVersion: session.consentTermVersion ?? "unknown",
  });
  await db
    .update(biometricVerificationSessions)
    .set({
      providerKey: result.providerKey,
      externalSessionRef: result.externalSessionRef ?? null,
      status: result.status,
      resultMetadata: { score: result.score, detail: result.detail },
      updatedAt: new Date(),
    })
    .where(eq(biometricVerificationSessions.id, sessionId));
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "professional_verification.biometric.start",
    resourceType: "biometric_verification_session",
    resourceId: sessionId,
    metadata: { status: result.status, providerKey: result.providerKey },
    requestId: meta.requestId,
  });
  return { status: result.status, externalSessionRef: result.externalSessionRef ?? null };
}

export async function reviewProfessionalVerificationCase(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  caseId: string,
  input: { decision: "approved" | "rejected"; reasonCode?: string; notes?: string },
  moduleDeps: ProfessionalVerificationModuleDeps,
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyProfessionalVerification(access, "professional_verification.approve"),
  );
  const row = await getCaseOrThrow(db, caseId);
  const selfDecision = policyProfessionalVerificationReviewDecision({
    reviewerUserId: account.user.id,
    caseSubjectUserId: row.userId,
    decision: input.decision,
  });
  if (!selfDecision.ok) throw new AppError(selfDecision.code, selfDecision.message);

  const nextStatus: (typeof professionalVerificationCases.$inferSelect)["status"] =
    input.decision === "approved" ? "verified" : "rejected";
  if (input.decision === "approved") {
    const metaRow = (row.subjectMetadata ?? {}) as Record<string, unknown>;
    if (
      row.verificationType === "oab" &&
      metaRow.informedOnly === true &&
      !metaRow.providerVerified
    ) {
      throw new AppError(
        "AUTHORIZATION_ERROR",
        "OAB informada não pode ser aprovada como verificada sem o provedor.",
      );
    }
    if (row.verificationType === "cpf" && metaRow.identityVerified !== true) {
      throw new AppError(
        "AUTHORIZATION_ERROR",
        "CPF com formato válido não prova identidade. Aprovação exige bureau configurado.",
      );
    }
    if (row.verificationType === "biometric") {
      throw new AppError(
        "AUTHORIZATION_ERROR",
        "Biometria exige sessão concluída via provedor configurado.",
      );
    }
  }

  await db.insert(professionalVerificationReviews).values({
    caseId,
    reviewerMembershipId: membership.membershipId,
    decision: input.decision,
    reasonCode: input.reasonCode ?? null,
    notes: input.notes ?? null,
  });

  const [updated] = await db
    .update(professionalVerificationCases)
    .set({
      status: nextStatus,
      reviewedAt: new Date(),
      approvedAt: input.decision === "approved" ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(professionalVerificationCases.id, caseId))
    .returning();

  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "professional_verification.review",
    resourceType: "professional_verification_case",
    resourceId: caseId,
    metadata: { decision: input.decision, reasonCode: input.reasonCode ?? null },
    requestId: meta.requestId,
  });
  return { case: serializeCase(updated!) };
}

export async function createProfessionalSuspension(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    professionalProfileId: string;
    reason: string;
    scope: (typeof professionalSuspensions.$inferSelect)["scope"];
    endsAt?: string;
  },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyProfessionalVerification(access, "professional_verification.suspend"),
  );
  const [row] = await db
    .insert(professionalSuspensions)
    .values({
      professionalProfileId: input.professionalProfileId,
      reason: input.reason,
      scope: input.scope,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      createdByMembershipId: membership.membershipId,
    })
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "professional_verification.suspension.create",
    resourceType: "professional_suspension",
    resourceId: row!.id,
    metadata: { scope: input.scope },
    requestId: meta.requestId,
  });
  return { suspension: row };
}

export async function createRevalidationRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { professionalProfileId: string; trigger: string; dueAt?: string },
  meta: RequestMeta,
) {
  const membership = authorize(account, organizationId, (access) =>
    policyProfessionalVerification(access, "professional_verification.revalidate"),
  );
  const [row] = await db
    .insert(professionalRevalidationRequests)
    .values({
      professionalProfileId: input.professionalProfileId,
      trigger: input.trigger,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
    })
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "professional_verification.revalidation.create",
    resourceType: "professional_revalidation_request",
    resourceId: row!.id,
    requestId: meta.requestId,
  });
  return { request: row };
}

/** Indicadores públicos permitidos — sem PII nem afirmações não verificadas. */
export async function getProfessionalTrustSummary(db: AppDatabase, profileUserId: string) {
  const cases = await db
    .select()
    .from(professionalVerificationCases)
    .where(eq(professionalVerificationCases.professionalProfileId, profileUserId));
  const activeSuspension = await db
    .select()
    .from(professionalSuspensions)
    .where(
      and(
        eq(professionalSuspensions.professionalProfileId, profileUserId),
        eq(professionalSuspensions.status, "active"),
      ),
    )
    .limit(1);
  const indicators = {
    oabVerified: cases.some((c) => c.verificationType === "oab" && c.status === "verified"),
    cpfFormatValidated: cases.some(
      (c) =>
        c.verificationType === "cpf" &&
        (c.subjectMetadata as Record<string, unknown> | null)?.formatValid === true,
    ),
    identityProviderVerified: cases.some(
      (c) =>
        c.verificationType === "cpf" &&
        (c.subjectMetadata as Record<string, unknown> | null)?.identityVerified === true,
    ),
    biometricConfigured: cases.some(
      (c) => c.verificationType === "biometric" && c.status === "verified",
    ),
    suspended: activeSuspension.length > 0,
  };
  return {
    profileUserId,
    indicators,
    disclaimer:
      "Indicadores não substituem due diligence. OAB informada ≠ verificada; CPF válido ≠ identidade.",
  };
}
