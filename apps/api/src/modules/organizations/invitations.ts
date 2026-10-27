import { recordAudit } from "@verasjuris/audit";
import { authorizeAccess, policyInviteWithRole, type SessionAccount } from "@verasjuris/auth";
import {
  isUniqueViolation,
  membershipRoles,
  organizationInvitations,
  organizationMembers,
  organizations,
  roles,
  users,
  type AppDatabase,
} from "@verasjuris/database";
import { publicEmailDeliveryMessage, type EmailDeliveryStatus } from "@verasjuris/email";
import type { InProcessEventBus } from "@verasjuris/events";
import { generateOpaqueToken, hashOpaqueToken, INVITATION_TTL_MS } from "@verasjuris/security";
import { AppError, type SystemRoleKey } from "@verasjuris/types";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { AuthEmailContext, RequestMeta } from "../auth/service.js";

type InviteRole = Extract<SystemRoleKey, "administrator" | "member">;

function membershipOf(account: SessionAccount, organizationId: string) {
  return account.memberships.find((item) => item.organizationId === organizationId) ?? null;
}

function accessMembership(membership: NonNullable<ReturnType<typeof membershipOf>>) {
  return {
    status: membership.membershipStatus,
    organizationStatus: membership.organizationStatus,
    permissions: membership.permissions,
    roles: membership.roles,
  };
}

function invitationStatus(row: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): "pending" | "accepted" | "revoked" | "expired" {
  if (row.acceptedAt) return "accepted";
  if (row.revokedAt) return "revoked";
  if (row.expiresAt <= new Date()) return "expired";
  return "pending";
}

type Executor = Pick<AppDatabase, "query" | "insert" | "update" | "delete" | "execute">;

async function requireSystemRole(db: Executor, key: SystemRoleKey) {
  const role = await db.query.roles.findFirst({
    where: and(eq(roles.key, key), eq(roles.isSystem, true)),
  });
  if (!role) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Os papéis de referência não estão disponíveis. Nenhuma alteração foi confirmada. Execute a carga inicial do banco.",
    );
  }
  return role;
}

function invitationLink(webOrigin: string, token: string): string {
  return `${webOrigin}/convite?token=${encodeURIComponent(token)}`;
}

export async function createInvitation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: { email: string; roleKey: InviteRole },
  meta: RequestMeta,
  email: AuthEmailContext,
) {
  const membership = membershipOf(account, organizationId);
  const decision = policyInviteWithRole({
    membership: membership ? accessMembership(membership) : null,
    actor: {
      roles: membership?.roles ?? [],
      permissions: membership?.permissions ?? [],
    },
    inviteRole: input.roleKey,
  });
  if (!decision.ok) {
    throw new AppError(decision.code, decision.message);
  }
  const organization = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });
  if (organization?.status !== "active") {
    throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  }

  const existingMemberUser = await db.query.users.findFirst({
    where: eq(users.email, input.email),
  });
  if (existingMemberUser) {
    const existingMembership = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, existingMemberUser.id),
      ),
    });
    if (existingMembership && existingMembership.status !== "removed") {
      throw new AppError(
        "CONFLICT",
        "Esta pessoa já participa da organização. Nenhum convite foi criado.",
      );
    }
  }

  const now = new Date();
  const { token, hash } = generateOpaqueToken();
  const [invitation] = await db
    .insert(organizationInvitations)
    .values({
      organizationId,
      email: input.email,
      invitedByUserId: account.user.id,
      roleKey: input.roleKey,
      tokenHash: hash,
      expiresAt: new Date(now.getTime() + INVITATION_TTL_MS),
    })
    .returning({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      roleKey: organizationInvitations.roleKey,
      expiresAt: organizationInvitations.expiresAt,
    });
  if (!invitation) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Não foi possível criar o convite. Nenhum convite foi registrado. Tente novamente.",
    );
  }

  const sent = await email.provider.send({
    kind: "organization_invitation",
    to: input.email,
    subject: `Convite para ${organization.name} no VerasJuris`,
    text: `Você foi convidado para ${organization.name}. Aceite em: ${invitationLink(email.webOrigin, token)}`,
    token,
    metadata: { organizationId, invitationId: invitation.id },
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "organization.invitation_created",
    resourceType: "invitation",
    resourceId: invitation.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { email: invitation.email, roleKey: invitation.roleKey, delivery: sent.status },
  });

  return {
    invitation: {
      id: invitation.id,
      email: invitation.email,
      roleKey: invitation.roleKey,
      status: "pending" as const,
      expiresAt: invitation.expiresAt.toISOString(),
      emailDelivery: sent.status as EmailDeliveryStatus,
      message: publicEmailDeliveryMessage(sent.status),
    },
  };
}

export async function listInvitations(db: AppDatabase, organizationId: string) {
  const rows = await db.query.organizationInvitations.findMany({
    where: and(
      eq(organizationInvitations.organizationId, organizationId),
      isNull(organizationInvitations.acceptedAt),
      isNull(organizationInvitations.revokedAt),
    ),
    orderBy: [desc(organizationInvitations.createdAt)],
  });
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    roleKey: row.roleKey,
    status: invitationStatus(row),
    expiresAt: row.expiresAt.toISOString(),
    expired: invitationStatus(row) === "expired",
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function revokeInvitation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  invitationId: string,
  meta: RequestMeta,
) {
  const membership = membershipOf(account, organizationId);
  const decision = authorizeAccess({
    membership: membership
      ? {
          status: membership.membershipStatus,
          organizationStatus: membership.organizationStatus,
          permissions: membership.permissions,
          roles: membership.roles,
        }
      : null,
    required: "member.invite",
  });
  if (!decision.ok) {
    throw new AppError(decision.code, decision.message);
  }
  const now = new Date();
  const [updated] = await db
    .update(organizationInvitations)
    .set({ revokedAt: now })
    .where(
      and(
        eq(organizationInvitations.id, invitationId),
        eq(organizationInvitations.organizationId, organizationId),
        isNull(organizationInvitations.acceptedAt),
        isNull(organizationInvitations.revokedAt),
      ),
    )
    .returning({ id: organizationInvitations.id });
  if (!updated) {
    throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  }
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "organization.invitation_revoked",
    resourceType: "invitation",
    resourceId: invitationId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return { revoked: true as const };
}

export async function resendInvitation(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  invitationId: string,
  meta: RequestMeta,
  email: AuthEmailContext,
) {
  const membership = membershipOf(account, organizationId);
  const decision = authorizeAccess({
    membership: membership ? accessMembership(membership) : null,
    required: "member.invite",
  });
  if (!decision.ok) {
    throw new AppError(decision.code, decision.message);
  }

  const existing = await db.query.organizationInvitations.findFirst({
    where: and(
      eq(organizationInvitations.id, invitationId),
      eq(organizationInvitations.organizationId, organizationId),
    ),
    with: { organization: true },
  });
  if (!existing || existing.acceptedAt || existing.revokedAt) {
    throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  }
  if (existing.organization.status !== "active") {
    throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  }

  const now = new Date();
  const { token, hash } = generateOpaqueToken();
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);
  await db
    .update(organizationInvitations)
    .set({ tokenHash: hash, expiresAt, revokedAt: null })
    .where(eq(organizationInvitations.id, invitationId));

  const sent = await email.provider.send({
    kind: "organization_invitation",
    to: existing.email,
    subject: `Convite para ${existing.organization.name} no VerasJuris`,
    text: `Você foi convidado para ${existing.organization.name}. Aceite em: ${invitationLink(email.webOrigin, token)}`,
    token,
    metadata: { organizationId, invitationId },
  });

  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "organization.invitation_resent",
    resourceType: "invitation",
    resourceId: invitationId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    metadata: { delivery: sent.status },
  });

  return {
    invitation: {
      id: invitationId,
      email: existing.email,
      roleKey: existing.roleKey,
      status: "pending" as const,
      expiresAt: expiresAt.toISOString(),
      emailDelivery: sent.status as EmailDeliveryStatus,
      message: publicEmailDeliveryMessage(sent.status),
    },
  };
}

export async function previewInvitation(db: AppDatabase, token: string) {
  const hash = hashOpaqueToken(token);
  const row = await db.query.organizationInvitations.findFirst({
    where: eq(organizationInvitations.tokenHash, hash),
    with: { organization: true },
  });
  if (!row || row.revokedAt || row.acceptedAt || row.expiresAt <= new Date()) {
    throw new AppError(
      "AUTHENTICATION_ERROR",
      "Este convite não é válido ou já expirou. Nenhuma alteração foi feita.",
    );
  }
  return {
    email: row.email,
    roleKey: row.roleKey,
    organizationName: row.organization.name,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function acceptInvitation(
  db: AppDatabase,
  account: SessionAccount,
  token: string,
  meta: RequestMeta,
  events: InProcessEventBus,
) {
  const hash = hashOpaqueToken(token);
  const now = new Date();
  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`
      select id from organization_invitations
      where token_hash = ${hash}
      for update
    `);
    const row = await tx.query.organizationInvitations.findFirst({
      where: eq(organizationInvitations.tokenHash, hash),
      with: { organization: true },
    });
    if (!row || row.revokedAt) {
      throw new AppError(
        "AUTHENTICATION_ERROR",
        "Este convite não é válido ou já expirou. Nenhuma alteração foi feita.",
      );
    }
    if (row.acceptedAt) {
      throw new AppError(
        "CONFLICT",
        "Este convite já foi utilizado. Nenhuma alteração adicional foi feita.",
      );
    }
    if (row.expiresAt <= now) {
      throw new AppError(
        "AUTHENTICATION_ERROR",
        "Este convite não é válido ou já expirou. Nenhuma alteração foi feita.",
      );
    }
    if (row.email !== account.user.email) {
      throw new AppError(
        "AUTHORIZATION_ERROR",
        "Este convite foi emitido para outro e-mail. Nenhuma participação foi criada.",
      );
    }
    if (row.organization.status !== "active") {
      throw new AppError(
        "AUTHORIZATION_ERROR",
        "A organização deste convite não está ativa. Nenhuma participação foi criada.",
      );
    }

    const roleKey = row.roleKey as InviteRole;
    const role = await requireSystemRole(tx, roleKey);

    const existing = await tx.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, row.organizationId),
        eq(organizationMembers.userId, account.user.id),
      ),
    });

    let membershipId = existing?.id ?? "";
    if (existing && existing.status !== "removed") {
      await tx
        .update(organizationInvitations)
        .set({ acceptedAt: now })
        .where(eq(organizationInvitations.id, row.id));
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId: row.organizationId,
        action: "organization.invitation_accepted",
        resourceType: "invitation",
        resourceId: row.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { membershipId: existing.id, alreadyMember: true },
      });
      return {
        membershipId: existing.id,
        organizationId: row.organizationId,
        organizationName: row.organization.name,
        roles: [roleKey],
        alreadyMember: true,
      };
    }

    if (existing) {
      await tx
        .update(organizationMembers)
        .set({ status: "active", updatedAt: now })
        .where(eq(organizationMembers.id, existing.id));
      await tx.delete(membershipRoles).where(eq(membershipRoles.membershipId, existing.id));
      await tx.insert(membershipRoles).values({ membershipId: existing.id, roleId: role.id });
      membershipId = existing.id;
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId: row.organizationId,
        action: "membership.updated",
        resourceType: "membership",
        resourceId: membershipId,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        before: { status: existing.status },
        after: { status: "active", roles: [roleKey] },
      });
    } else {
      try {
        const [created] = await tx
          .insert(organizationMembers)
          .values({
            organizationId: row.organizationId,
            userId: account.user.id,
            status: "active",
          })
          .returning({ id: organizationMembers.id });
        if (!created) {
          throw new AppError(
            "INTERNAL_ERROR",
            "Não foi possível criar a participação. Nenhuma participação foi registrada. Tente novamente.",
          );
        }
        membershipId = created.id;
        await tx.insert(membershipRoles).values({ membershipId, roleId: role.id });
        await recordAudit(tx, {
          actorUserId: account.user.id,
          organizationId: row.organizationId,
          action: "membership.created",
          resourceType: "membership",
          resourceId: membershipId,
          source: "api",
          requestId: meta.requestId,
          ip: meta.ip,
          after: { status: "active", roles: [roleKey] },
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError(
            "CONFLICT",
            "Esta pessoa já participa da organização. Nenhuma participação nova foi criada.",
          );
        }
        throw error;
      }
    }

    await tx
      .update(organizationInvitations)
      .set({ acceptedAt: now })
      .where(eq(organizationInvitations.id, row.id));
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId: row.organizationId,
      action: "organization.invitation_accepted",
      resourceType: "invitation",
      resourceId: row.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { membershipId, roles: [roleKey] },
    });
    return {
      membershipId,
      organizationId: row.organizationId,
      organizationName: row.organization.name,
      roles: [roleKey],
      alreadyMember: false,
    };
  });

  events.publish("membership.changed", {
    organizationId: result.organizationId,
    membershipId: result.membershipId,
    actorUserId: account.user.id,
    requestId: meta.requestId,
  });
  return result;
}

export async function switchOrganization(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  meta: RequestMeta,
) {
  const membership = membershipOf(account, organizationId);
  if (membership?.membershipStatus !== "active" || membership?.organizationStatus !== "active") {
    throw new AppError(
      "NOT_FOUND",
      "Essa organização não está disponível para a sua conta. A seleção não foi alterada.",
    );
  }
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "organization.switched",
    resourceType: "organization",
    resourceId: organizationId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
  });
  return {
    organizationId: membership.organizationId,
    name: membership.organizationName,
    slug: membership.organizationSlug,
  };
}
