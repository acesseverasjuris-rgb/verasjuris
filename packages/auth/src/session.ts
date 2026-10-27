import {
  membershipRoles,
  organizationMembers,
  sessions,
  type AppDatabase,
} from "@verasjuris/database";
import { hashSessionToken } from "@verasjuris/security";
import { and, eq, gt, inArray, isNull, ne } from "drizzle-orm";

export type UserStatus = "active" | "pending_verification" | "suspended" | "disabled";

export type SessionAccount = {
  sessionId: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    locale: string;
    timeZone: string;
    status: UserStatus;
    emailVerifiedAt: Date | null;
  };
  professionalVerificationStatus: "not_submitted" | "pending" | "verified" | "rejected";
  memberships: Array<{
    membershipId: string;
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    organizationStatus: "active" | "suspended";
    membershipStatus: "active" | "suspended" | "removed";
    roles: string[];
    permissions: string[];
  }>;
};

export async function findSession(
  db: AppDatabase,
  token: string,
  now = new Date(),
): Promise<SessionAccount | null> {
  // Consultas separadas evitam aliases relacionais do Drizzle com mais de 63 caracteres.
  const row = await db.query.sessions.findFirst({
    where: and(
      eq(sessions.tokenHash, hashSessionToken(token)),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now),
    ),
    with: {
      user: {
        with: {
          profile: true,
          professionalProfile: true,
        },
      },
    },
  });
  if (
    !row?.user.profile ||
    !row.user.professionalProfile ||
    row.user.status !== "active" ||
    !row.user.emailVerifiedAt
  ) {
    return null;
  }

  // Atualiza lastUsedAt no máximo a cada 5 minutos para não escrever a cada request.
  const lastUsed = row.lastUsedAt?.getTime() ?? 0;
  if (now.getTime() - lastUsed > 5 * 60 * 1000) {
    await db.update(sessions).set({ lastUsedAt: now }).where(eq(sessions.id, row.id));
  }

  const membershipRows = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.userId, row.user.id),
    with: { organization: true },
  });

  const membershipIds = membershipRows.map((membership) => membership.id);
  const roleLinks =
    membershipIds.length === 0
      ? []
      : await db.query.membershipRoles.findMany({
          where: inArray(membershipRoles.membershipId, membershipIds),
          with: {
            role: {
              with: {
                rolePermissions: { with: { permission: true } },
              },
            },
          },
        });

  const rolesByMembership = new Map<string, { roles: string[]; permissions: string[] }>();
  for (const link of roleLinks) {
    const current = rolesByMembership.get(link.membershipId) ?? { roles: [], permissions: [] };
    current.roles.push(link.role.key);
    current.permissions.push(...link.role.rolePermissions.map((item) => item.permission.key));
    rolesByMembership.set(link.membershipId, current);
  }

  return {
    sessionId: row.id,
    user: {
      id: row.user.id,
      email: row.user.email,
      displayName: row.user.profile.displayName,
      locale: row.user.profile.locale,
      timeZone: row.user.profile.timeZone,
      status: row.user.status,
      emailVerifiedAt: row.user.emailVerifiedAt,
    },
    professionalVerificationStatus: row.user.professionalProfile.verificationStatus,
    memberships: membershipRows.map((membership) => {
      const linked = rolesByMembership.get(membership.id);
      return {
        membershipId: membership.id,
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        organizationSlug: membership.organization.slug,
        organizationStatus: membership.organization.status,
        membershipStatus: membership.status,
        roles: linked?.roles ?? [],
        permissions: [...new Set(linked?.permissions ?? [])],
      };
    }),
  };
}

export function toPublicSession(account: SessionAccount) {
  return {
    user: {
      id: account.user.id,
      email: account.user.email,
      displayName: account.user.displayName,
      locale: account.user.locale,
      timeZone: account.user.timeZone,
      status: account.user.status,
      emailVerified: Boolean(account.user.emailVerifiedAt),
    },
    professionalVerificationStatus: account.professionalVerificationStatus,
    memberships: account.memberships
      .filter((membership) => membership.membershipStatus !== "removed")
      .map((membership) => ({
        membershipId: membership.membershipId,
        organizationId: membership.organizationId,
        organizationName: membership.organizationName,
        organizationSlug: membership.organizationSlug,
        organizationStatus: membership.organizationStatus,
        membershipStatus: membership.membershipStatus,
        roles: membership.roles,
        permissions: membership.permissions,
      })),
  };
}

export async function revokeSession(
  db: Pick<AppDatabase, "update">,
  sessionId: string,
  now = new Date(),
): Promise<void> {
  await db.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, sessionId));
}

export async function revokeOtherSessions(
  db: Pick<AppDatabase, "update">,
  userId: string,
  keepSessionId: string,
  now = new Date(),
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(
      and(eq(sessions.userId, userId), isNull(sessions.revokedAt), ne(sessions.id, keepSessionId)),
    );
}

export async function revokeAllUserSessions(
  db: Pick<AppDatabase, "update">,
  userId: string,
  now = new Date(),
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}
