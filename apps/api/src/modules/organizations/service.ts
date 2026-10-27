import { recordAudit } from "@verasjuris/audit";
import {
  actorCanGrantRole,
  authorizeAccess,
  wouldRemoveLastOwner,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  auditEvents,
  isUniqueViolation,
  membershipRoles,
  organizationMembers,
  organizations,
  profiles,
  roles,
  users,
  type AppDatabase,
} from "@verasjuris/database";
import type { InProcessEventBus } from "@verasjuris/events";
import { AppError, type PermissionKey, type SystemRoleKey } from "@verasjuris/types";
import { slugifyName } from "@verasjuris/validation";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";
import { ensureCrmCatalog } from "../crm/catalog.js";
import { ensureLegalAreasCatalog } from "../intake/catalog.js";
import { ensureJudicialReferenceCatalog } from "../judicial/catalog.js";
import { ensureDemandTypesCatalog } from "../matters/catalog.js";
import { ensureLossReasonsCatalog } from "../pipeline/catalog.js";

type Executor = Pick<AppDatabase, "insert" | "query" | "update" | "delete" | "execute">;

async function availableSlug(db: Executor, name: string): Promise<string> {
  const base = slugifyName(name);
  for (let index = 0; index < 20; index += 1) {
    const candidate = index === 0 ? base : `${base}-${index + 1}`.slice(0, 70);
    const existing = await db.query.organizations.findFirst({
      where: eq(organizations.slug, candidate),
    });
    if (!existing) return candidate;
  }
  throw new AppError(
    "CONFLICT",
    "Não foi possível reservar o identificador da organização. Nenhuma organização foi criada. Tente novamente.",
  );
}

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

function membershipOf(account: SessionAccount, organizationId: string) {
  return account.memberships.find((item) => item.organizationId === organizationId) ?? null;
}

export async function createOrganization(
  db: AppDatabase,
  account: SessionAccount,
  name: string,
  meta: RequestMeta,
  events: InProcessEventBus,
): Promise<{ id: string; name: string; slug: string; status: "active" | "suspended" }> {
  const slug = await availableSlug(db, name);
  const created = await db.transaction(async (tx) => {
    const ownerRole = await requireSystemRole(tx, "owner");
    const [organization] = await tx
      .insert(organizations)
      .values({ name, slug, createdByUserId: account.user.id })
      .returning({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        status: organizations.status,
      });
    if (!organization) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Não foi possível criar a organização. Nenhuma organização foi registrada. Tente novamente.",
      );
    }
    const [membership] = await tx
      .insert(organizationMembers)
      .values({ organizationId: organization.id, userId: account.user.id, status: "active" })
      .returning({ id: organizationMembers.id });
    if (!membership) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Não foi possível criar a organização. Nenhuma participação foi registrada. Tente novamente.",
      );
    }
    await tx.insert(membershipRoles).values({ membershipId: membership.id, roleId: ownerRole.id });
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId: organization.id,
      action: "organization.created",
      resourceType: "organization",
      resourceId: organization.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { name: organization.name, slug: organization.slug, status: organization.status },
    });
    return organization;
  });
  await ensureCrmCatalog(db, created.id);
  await ensureLegalAreasCatalog(db, created.id);
  await ensureDemandTypesCatalog(db, created.id);
  await ensureLossReasonsCatalog(db, created.id);
  await ensureJudicialReferenceCatalog(db);
  events.publish("organization.created", {
    organizationId: created.id,
    actorUserId: account.user.id,
    requestId: meta.requestId,
  });
  return created;
}

export async function updateOrganization(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  name: string,
  meta: RequestMeta,
) {
  const current = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
  });
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
    required: "organization.update",
  });
  if (!current || !decision.ok) {
    throw new AppError(
      decision.ok ? "NOT_FOUND" : decision.code,
      decision.ok ? "Não encontramos este recurso no seu acesso." : decision.message,
    );
  }
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(organizations)
      .set({ name, updatedAt: new Date() })
      .where(eq(organizations.id, organizationId))
      .returning({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        status: organizations.status,
      });
    if (!updated) {
      throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
    }
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "organization.updated",
      resourceType: "organization",
      resourceId: organizationId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { name: current.name },
      after: { name: updated.name },
    });
    return updated;
  });
}

export async function listMembers(db: AppDatabase, organizationId: string) {
  const rows = await db.query.organizationMembers.findMany({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      inArray(organizationMembers.status, ["active", "suspended"]),
    ),
    with: {
      user: { with: { profile: true } },
      membershipRoles: { with: { role: true } },
    },
  });
  return rows.map((row) => ({
    membershipId: row.id,
    status: row.status,
    userId: row.userId,
    displayName: row.user.profile?.displayName ?? "Nome não informado",
    email: row.user.email,
    roles: row.membershipRoles.map((link) => link.role.key),
  }));
}

export async function addMember(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  email: string,
  meta: RequestMeta,
  events: InProcessEventBus,
) {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    with: { profile: true },
  });
  if (user?.status !== "active") {
    throw new AppError(
      "NOT_FOUND",
      "Não encontramos uma conta ativa com este e-mail. Nenhuma participação foi criada.",
    );
  }
  const memberRole = await requireSystemRole(db, "member");
  const existing = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.userId, user.id),
    ),
  });
  if (existing && existing.status !== "removed") {
    throw new AppError(
      "CONFLICT",
      "Esta pessoa já participa da organização. Nenhuma participação nova foi criada.",
    );
  }
  const membershipId = await db
    .transaction(async (tx) => {
      if (existing) {
        await tx
          .update(organizationMembers)
          .set({ status: "active", updatedAt: new Date() })
          .where(eq(organizationMembers.id, existing.id));
        await tx.delete(membershipRoles).where(eq(membershipRoles.membershipId, existing.id));
        await tx
          .insert(membershipRoles)
          .values({ membershipId: existing.id, roleId: memberRole.id });
        await recordAudit(tx, {
          actorUserId: account.user.id,
          organizationId,
          action: "membership.updated",
          resourceType: "membership",
          resourceId: existing.id,
          source: "api",
          requestId: meta.requestId,
          ip: meta.ip,
          before: { status: existing.status },
          after: { status: "active", roles: ["member"] },
        });
        return existing.id;
      }
      const [created] = await tx
        .insert(organizationMembers)
        .values({ organizationId, userId: user.id, status: "active" })
        .returning({ id: organizationMembers.id });
      if (!created) {
        throw new AppError(
          "INTERNAL_ERROR",
          "Não foi possível criar a participação. Nenhuma participação foi registrada. Tente novamente.",
        );
      }
      await tx.insert(membershipRoles).values({ membershipId: created.id, roleId: memberRole.id });
      await recordAudit(tx, {
        actorUserId: account.user.id,
        organizationId,
        action: "membership.created",
        resourceType: "membership",
        resourceId: created.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { status: "active", roles: ["member"] },
      });
      return created.id;
    })
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError(
          "CONFLICT",
          "Esta pessoa já participa da organização. Nenhuma participação nova foi criada.",
        );
      }
      throw error;
    });
  events.publish("membership.changed", {
    organizationId,
    membershipId,
    actorUserId: account.user.id,
    requestId: meta.requestId,
  });
  return {
    membershipId,
    email: user.email,
    displayName: user.profile?.displayName ?? "Nome não informado",
    roles: ["member"],
    status: "active" as const,
  };
}

async function countOtherOwners(
  db: Executor,
  organizationId: string,
  membershipId: string,
): Promise<number> {
  const rows = await db.query.organizationMembers.findMany({
    where: and(
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.status, "active"),
    ),
    with: { membershipRoles: { with: { role: true } } },
  });
  return rows.filter(
    (row) =>
      row.id !== membershipId && row.membershipRoles.some((link) => link.role.key === "owner"),
  ).length;
}

export async function updateMembership(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  membershipId: string,
  input: { roleKeys?: SystemRoleKey[]; status?: "active" | "removed" },
  meta: RequestMeta,
  events: InProcessEventBus,
) {
  const actor = membershipOf(account, organizationId);
  const target = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.id, membershipId),
      eq(organizationMembers.organizationId, organizationId),
    ),
    with: { membershipRoles: { with: { role: true } } },
  });
  if (actor?.membershipStatus !== "active" || !target || target.status === "removed") {
    throw new AppError("NOT_FOUND", "Não encontramos este recurso no seu acesso.");
  }
  const currentRoles = target.membershipRoles.map((link) => link.role.key as SystemRoleKey);
  const nextRoles: SystemRoleKey[] = input.roleKeys ? [...new Set(input.roleKeys)] : currentRoles;
  const nextStatus = input.status ?? target.status;
  const touchesOwner = currentRoles.includes("owner") || nextRoles.includes("owner");
  if (touchesOwner && !actor.roles.includes("owner")) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Somente um proprietário pode alterar este acesso. Nenhuma alteração foi confirmada.",
    );
  }
  if (input.roleKeys && !actor.permissions.includes("role.assign")) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Você não tem permissão para atribuir papéis. Nenhuma alteração foi confirmada.",
    );
  }
  if (
    input.status &&
    !actor.permissions.includes("member.manage") &&
    !actor.permissions.includes("role.assign")
  ) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Você não tem permissão para alterar esta participação. Nenhuma alteração foi confirmada.",
    );
  }
  if (input.roleKeys) {
    for (const roleKey of nextRoles) {
      if (
        !actorCanGrantRole({
          actorRoles: actor.roles,
          actorPermissions: actor.permissions,
          targetRole: roleKey,
        })
      ) {
        throw new AppError(
          "AUTHORIZATION_ERROR",
          "Você não pode atribuir este papel. Nenhuma alteração foi confirmada.",
        );
      }
    }
  }
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      select id
      from organization_members
      where organization_id = ${organizationId}
        and status = 'active'
      for update
    `);
    if (
      wouldRemoveLastOwner({
        currentRoles,
        nextRoles,
        nextStatus: nextStatus === "suspended" ? "suspended" : nextStatus,
        otherActiveOwnerCount: await countOtherOwners(tx, organizationId, membershipId),
      })
    ) {
      throw new AppError(
        "CONFLICT",
        "A organização precisa manter ao menos um proprietário ativo. Nenhuma alteração foi confirmada.",
      );
    }
    if (input.status) {
      await tx
        .update(organizationMembers)
        .set({ status: input.status, updatedAt: new Date() })
        .where(eq(organizationMembers.id, membershipId));
    }
    if (input.roleKeys) {
      await tx.delete(membershipRoles).where(eq(membershipRoles.membershipId, membershipId));
      if (nextStatus !== "removed") {
        for (const roleKey of nextRoles) {
          const role = await requireSystemRole(tx, roleKey);
          await tx.insert(membershipRoles).values({ membershipId, roleId: role.id });
        }
      }
    }
    await recordAudit(tx, {
      actorUserId: account.user.id,
      organizationId,
      action: "membership.updated",
      resourceType: "membership",
      resourceId: membershipId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before: { status: target.status, roles: currentRoles },
      after: { status: nextStatus, roles: nextStatus === "removed" ? [] : nextRoles },
    });
  });
  events.publish("membership.changed", {
    organizationId,
    membershipId,
    actorUserId: account.user.id,
    requestId: meta.requestId,
  });
  return { membershipId, status: nextStatus, roles: nextStatus === "removed" ? [] : nextRoles };
}

export async function listOrganizationAudit(db: AppDatabase, organizationId: string) {
  const rows = await db.query.auditEvents.findMany({
    where: eq(auditEvents.organizationId, organizationId),
    orderBy: [desc(auditEvents.occurredAt)],
    limit: 50,
  });
  const actorIds = [...new Set(rows.flatMap((row) => (row.actorUserId ? [row.actorUserId] : [])))];
  const actors = actorIds.length
    ? await db.query.profiles.findMany({ where: inArray(profiles.userId, actorIds) })
    : [];
  const names = new Map(actors.map((actor) => [actor.userId, actor.displayName]));
  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    actorUserId: row.actorUserId,
    actorDisplayName: row.actorUserId ? (names.get(row.actorUserId) ?? null) : null,
    requestId: row.requestId,
    ip: row.ip,
    metadata: row.metadata,
    before: row.before,
    after: row.after,
  }));
}

export async function listAccountAudit(db: AppDatabase, userId: string) {
  const rows = await db.query.auditEvents.findMany({
    where: and(eq(auditEvents.actorUserId, userId), isNull(auditEvents.organizationId)),
    orderBy: [desc(auditEvents.occurredAt)],
    limit: 20,
  });
  return rows.map((row) => ({
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    requestId: row.requestId,
    ip: row.ip,
  }));
}

export async function listSystemRoles(db: AppDatabase) {
  const rows = await db.query.roles.findMany({
    where: eq(roles.isSystem, true),
    with: { rolePermissions: { with: { permission: true } } },
  });
  return rows.map((role) => ({
    key: role.key,
    name: role.name,
    description: role.description,
    permissions: role.rolePermissions.map((link) => link.permission.key as PermissionKey),
  }));
}
