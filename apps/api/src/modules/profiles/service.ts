import { recordAudit } from "@verasjuris/audit";
import {
  policyProfessionalVerificationStatus,
  policyProfiles,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  employeeProfiles,
  lawyerProfiles,
  organizationClientUsers,
  organizationMembers,
  partnerProfiles,
  professionalProfiles,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, eq } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";

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

function hasActiveProfilePermission(
  account: SessionAccount,
  permission: "profiles.update_self" | "profiles.manage" | "profiles.read",
): boolean {
  return account.memberships.some(
    (item) =>
      item.membershipStatus === "active" &&
      item.organizationStatus === "active" &&
      item.permissions.includes(permission),
  );
}

function requireProfileSelfOrManage(account: SessionAccount): void {
  if (
    !hasActiveProfilePermission(account, "profiles.update_self") &&
    !hasActiveProfilePermission(account, "profiles.manage")
  ) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Você não tem permissão para atualizar perfis profissionais. Nenhum dado foi alterado.",
    );
  }
}

function rejectForcedVerification(input: Record<string, unknown>): void {
  if ("verificationStatus" in input && input.verificationStatus !== undefined) {
    const decision = policyProfessionalVerificationStatus(String(input.verificationStatus));
    if (!decision.ok) throw new AppError(decision.code, decision.message);
  }
}

function hasOabSubmission(input: { oabNumber?: string; oabUf?: string }): boolean {
  return Boolean(input.oabNumber?.trim() || input.oabUf?.trim());
}

async function ensureProfessionalProfile(db: AppDatabase, userId: string) {
  const existing = await db.query.professionalProfiles.findFirst({
    where: eq(professionalProfiles.userId, userId),
  });
  if (existing) return existing;
  const [created] = await db.insert(professionalProfiles).values({ userId }).returning();
  if (!created) {
    throw new AppError("INTERNAL_ERROR", "Não foi possível criar o perfil profissional.");
  }
  return created;
}

export async function getMyProfiles(
  db: AppDatabase,
  account: SessionAccount,
  organizationId?: string,
) {
  const userId = account.user.id;
  const [professional, lawyer, partner] = await Promise.all([
    db.query.professionalProfiles.findFirst({ where: eq(professionalProfiles.userId, userId) }),
    db.query.lawyerProfiles.findFirst({ where: eq(lawyerProfiles.userId, userId) }),
    db.query.partnerProfiles.findFirst({ where: eq(partnerProfiles.userId, userId) }),
  ]);

  const employeeFilters = [eq(employeeProfiles.userId, userId)];
  if (organizationId) {
    employeeFilters.push(eq(employeeProfiles.organizationId, organizationId));
  }
  const employees = await db.query.employeeProfiles.findMany({
    where: and(...employeeFilters),
    orderBy: [asc(employeeProfiles.createdAt)],
  });

  const organizationClients = organizationId
    ? await db.query.organizationClientUsers.findMany({
        where: and(
          eq(organizationClientUsers.organizationId, organizationId),
          eq(organizationClientUsers.userId, userId),
        ),
      })
    : [];

  return {
    professional: professional ?? null,
    lawyer: lawyer ?? null,
    partner: partner ?? null,
    employees,
    organizationClientUsers: organizationClients,
  };
}

export async function upsertLawyerProfile(
  db: AppDatabase,
  account: SessionAccount,
  input: {
    professionalName?: string;
    bio?: string;
    oabNumber?: string;
    oabUf?: string;
    oabSection?: string;
    oabSubsection?: string;
    declaredSituation?: string;
    practiceAreas?: string;
    languages?: string;
    remoteAvailable?: boolean;
    inPersonAvailable?: boolean;
    serviceRegions?: string;
    visibility?: "public" | "organization" | "private" | "internal";
  },
  meta: RequestMeta,
  rawInput?: Record<string, unknown>,
) {
  requireProfileSelfOrManage(account);
  rejectForcedVerification(rawInput ?? {});

  const userId = account.user.id;
  const existing = await db.query.lawyerProfiles.findFirst({
    where: eq(lawyerProfiles.userId, userId),
  });

  const profile = await db.transaction(async (tx) => {
    let lawyer: typeof existing | undefined;
    if (existing) {
      const [updated] = await tx
        .update(lawyerProfiles)
        .set({
          ...(input.professionalName !== undefined
            ? { professionalName: input.professionalName }
            : {}),
          ...(input.bio !== undefined ? { bio: input.bio } : {}),
          ...(input.oabNumber !== undefined ? { oabNumber: input.oabNumber } : {}),
          ...(input.oabUf !== undefined ? { oabUf: input.oabUf } : {}),
          ...(input.oabSection !== undefined ? { oabSection: input.oabSection } : {}),
          ...(input.oabSubsection !== undefined ? { oabSubsection: input.oabSubsection } : {}),
          ...(input.declaredSituation !== undefined
            ? { declaredSituation: input.declaredSituation }
            : {}),
          ...(input.practiceAreas !== undefined ? { practiceAreas: input.practiceAreas } : {}),
          ...(input.languages !== undefined ? { languages: input.languages } : {}),
          ...(input.remoteAvailable !== undefined
            ? { remoteAvailable: input.remoteAvailable }
            : {}),
          ...(input.inPersonAvailable !== undefined
            ? { inPersonAvailable: input.inPersonAvailable }
            : {}),
          ...(input.serviceRegions !== undefined ? { serviceRegions: input.serviceRegions } : {}),
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
          updatedAt: new Date(),
        })
        .where(eq(lawyerProfiles.userId, userId))
        .returning();
      lawyer = updated;
    } else {
      const [created] = await tx
        .insert(lawyerProfiles)
        .values({
          userId,
          professionalName: input.professionalName,
          bio: input.bio,
          oabNumber: input.oabNumber,
          oabUf: input.oabUf,
          oabSection: input.oabSection,
          oabSubsection: input.oabSubsection,
          declaredSituation: input.declaredSituation,
          practiceAreas: input.practiceAreas,
          languages: input.languages,
          remoteAvailable: input.remoteAvailable ?? false,
          inPersonAvailable: input.inPersonAvailable ?? false,
          serviceRegions: input.serviceRegions,
          visibility: input.visibility ?? "private",
        })
        .returning();
      lawyer = created;
    }
    if (!lawyer) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível salvar o perfil de advogado.");
    }

    if (hasOabSubmission(input)) {
      const professional = await ensureProfessionalProfile(tx, userId);
      if (professional.verificationStatus !== "verified") {
        await tx
          .update(professionalProfiles)
          .set({ verificationStatus: "pending", updatedAt: new Date() })
          .where(eq(professionalProfiles.userId, userId));
      }
    }

    await recordAudit(tx, {
      actorUserId: userId,
      action: "profile.lawyer_upserted",
      resourceType: "lawyer_profile",
      resourceId: userId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { visibility: lawyer.visibility },
    });

    return lawyer;
  });

  const professional = await db.query.professionalProfiles.findFirst({
    where: eq(professionalProfiles.userId, userId),
  });

  return { lawyer: profile, professional: professional ?? null };
}

export async function upsertPartnerProfile(
  db: AppDatabase,
  account: SessionAccount,
  input: {
    category?:
      | "correspondent"
      | "accountant"
      | "expert"
      | "translator"
      | "dispatcher"
      | "teacher"
      | "specialist"
      | "supplier"
      | "other";
    presentation?: string;
    services?: string;
    regions?: string;
    remoteAvailable?: boolean;
    inPersonAvailable?: boolean;
    availabilityNotes?: string;
    publicInfo?: string;
    visibility?: "public" | "organization" | "private" | "internal";
  },
  meta: RequestMeta,
  rawInput?: Record<string, unknown>,
) {
  requireProfileSelfOrManage(account);
  rejectForcedVerification(rawInput ?? {});

  const userId = account.user.id;
  const existing = await db.query.partnerProfiles.findFirst({
    where: eq(partnerProfiles.userId, userId),
  });

  const profile = await db.transaction(async (tx) => {
    let partner: typeof existing | undefined;
    if (existing) {
      const [updated] = await tx
        .update(partnerProfiles)
        .set({
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.presentation !== undefined ? { presentation: input.presentation } : {}),
          ...(input.services !== undefined ? { services: input.services } : {}),
          ...(input.regions !== undefined ? { regions: input.regions } : {}),
          ...(input.remoteAvailable !== undefined
            ? { remoteAvailable: input.remoteAvailable }
            : {}),
          ...(input.inPersonAvailable !== undefined
            ? { inPersonAvailable: input.inPersonAvailable }
            : {}),
          ...(input.availabilityNotes !== undefined
            ? { availabilityNotes: input.availabilityNotes }
            : {}),
          ...(input.publicInfo !== undefined ? { publicInfo: input.publicInfo } : {}),
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
          updatedAt: new Date(),
        })
        .where(eq(partnerProfiles.userId, userId))
        .returning();
      partner = updated;
    } else {
      const [created] = await tx
        .insert(partnerProfiles)
        .values({
          userId,
          category: input.category ?? "other",
          presentation: input.presentation,
          services: input.services,
          regions: input.regions,
          remoteAvailable: input.remoteAvailable ?? false,
          inPersonAvailable: input.inPersonAvailable ?? false,
          availabilityNotes: input.availabilityNotes,
          publicInfo: input.publicInfo,
          visibility: input.visibility ?? "organization",
        })
        .returning();
      partner = created;
    }
    if (!partner) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível salvar o perfil de parceiro.");
    }

    await recordAudit(tx, {
      actorUserId: userId,
      action: "profile.partner_upserted",
      resourceType: "partner_profile",
      resourceId: userId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { category: partner.category, visibility: partner.visibility },
    });

    return partner;
  });

  return { partner: profile };
}

export async function upsertEmployeeProfile(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    jobTitle: string;
    department?: string;
    internalCode?: string;
    status?: "active" | "inactive" | "left";
    internalNotes?: string;
  },
  meta: RequestMeta,
  rawInput?: Record<string, unknown>,
) {
  rejectForcedVerification(rawInput ?? {});

  const canManage = policyProfiles(accessOf(account, organizationId), "profiles.manage");
  const canSelf = policyProfiles(accessOf(account, organizationId), "profiles.update_self");

  if (!canManage.ok && !canSelf.ok) {
    throw new AppError(canManage.code, canManage.message);
  }

  const targetUserId = account.user.id;
  const orgMembership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, targetUserId),
      eq(organizationMembers.status, "active"),
    ),
  });
  if (!orgMembership) {
    throw new AppError(
      "VALIDATION_ERROR",
      "É necessário ser participante ativo desta organização para registrar o perfil de colaborador.",
    );
  }

  const existing = await db.query.employeeProfiles.findFirst({
    where: and(
      eq(employeeProfiles.organizationId, organizationId),
      eq(employeeProfiles.userId, targetUserId),
    ),
  });

  const profile = await db.transaction(async (tx) => {
    let employee: typeof existing | undefined;
    if (existing) {
      const [updated] = await tx
        .update(employeeProfiles)
        .set({
          jobTitle: input.jobTitle,
          ...(input.department !== undefined ? { department: input.department } : {}),
          ...(input.internalCode !== undefined ? { internalCode: input.internalCode } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.internalNotes !== undefined ? { internalNotes: input.internalNotes } : {}),
          membershipId: orgMembership.id,
          updatedAt: new Date(),
        })
        .where(eq(employeeProfiles.id, existing.id))
        .returning();
      employee = updated;
    } else {
      const [created] = await tx
        .insert(employeeProfiles)
        .values({
          organizationId,
          userId: targetUserId,
          membershipId: orgMembership.id,
          jobTitle: input.jobTitle,
          department: input.department,
          internalCode: input.internalCode,
          status: input.status ?? "active",
          internalNotes: input.internalNotes,
        })
        .returning();
      employee = created;
    }
    if (!employee) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível salvar o perfil de colaborador.");
    }

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "profile.employee_upserted",
      resourceType: "employee_profile",
      resourceId: employee.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { jobTitle: employee.jobTitle, status: employee.status },
    });

    return employee;
  });

  return { employee: profile };
}

export async function listEmployeeProfiles(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  const decision = policyProfiles(accessOf(account, organizationId), "profiles.read");
  if (!decision.ok) throw new AppError(decision.code, decision.message);

  const employees = await db.query.employeeProfiles.findMany({
    where: eq(employeeProfiles.organizationId, organizationId),
    orderBy: [asc(employeeProfiles.jobTitle)],
  });

  return { employees };
}

export async function linkOrganizationClientUser(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { crmClientId?: string; notes?: string },
  meta: RequestMeta,
) {
  requireProfileSelfOrManage(account);

  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, account.user.id),
      eq(organizationMembers.status, "active"),
    ),
  });
  if (!membership) {
    throw new AppError(
      "VALIDATION_ERROR",
      "É necessário ser participante ativo desta organização para vincular a conta de cliente.",
    );
  }

  const existing = await db.query.organizationClientUsers.findFirst({
    where: and(
      eq(organizationClientUsers.organizationId, organizationId),
      eq(organizationClientUsers.userId, account.user.id),
    ),
  });

  const link = await db.transaction(async (tx) => {
    let row: typeof existing | undefined;
    if (existing) {
      const [updated] = await tx
        .update(organizationClientUsers)
        .set({
          ...(input.crmClientId !== undefined ? { crmClientId: input.crmClientId } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(organizationClientUsers.id, existing.id))
        .returning();
      row = updated;
    } else {
      const [created] = await tx
        .insert(organizationClientUsers)
        .values({
          organizationId,
          userId: account.user.id,
          crmClientId: input.crmClientId,
          notes: input.notes,
        })
        .returning();
      row = created;
    }
    if (!row) {
      throw new AppError("INTERNAL_ERROR", "Não foi possível vincular a conta de cliente.");
    }

    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "profile.client_user_linked",
      resourceType: "organization_client_user",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { crmClientId: row.crmClientId },
    });

    return row;
  });

  return { organizationClientUser: link };
}
