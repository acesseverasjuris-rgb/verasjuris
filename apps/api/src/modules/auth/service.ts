import { recordAudit } from "@verasjuris/audit";
import {
  findSession,
  revokeAllUserSessions,
  revokeOtherSessions,
  revokeSession,
  toPublicSession,
  type SessionAccount,
} from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import {
  emailVerificationTokens,
  isUniqueViolation,
  passwordResetTokens,
  professionalProfiles,
  profiles,
  sessions,
  users,
} from "@verasjuris/database";
import {
  publicEmailDeliveryMessage,
  type EmailDeliveryStatus,
  type EmailProvider,
} from "@verasjuris/email";
import type { InProcessEventBus } from "@verasjuris/events";
import {
  EMAIL_VERIFICATION_TTL_MS,
  generateOpaqueToken,
  generateSessionToken,
  hashOpaqueToken,
  hashPassword,
  PASSWORD_RESET_TTL_MS,
  SESSION_TTL_MS,
  verifyPasswordOrDummy,
} from "@verasjuris/security";
import { AppError } from "@verasjuris/types";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

export type RequestMeta = {
  requestId: string;
  ip: string | null;
  userAgent: string | null;
};

export type AuthEmailContext = {
  provider: EmailProvider;
  webOrigin: string;
};

type Writer = Pick<AppDatabase, "insert" | "update" | "transaction" | "query" | "delete">;

const LOGIN_FAILURE_MESSAGE =
  "Não foi possível entrar. Confira e-mail e senha. Nenhuma sessão foi aberta.";

const NEUTRAL_ACCOUNT_MESSAGE =
  "Se existir uma conta elegível para este e-mail, enviaremos as próximas instruções.";

async function issueSession(
  db: Writer,
  userId: string,
  meta: RequestMeta,
  now = new Date(),
): Promise<{ token: string; sessionId: string }> {
  const { token, hash } = generateSessionToken();
  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash: hash,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
      ip: meta.ip,
      userAgent: meta.userAgent,
    })
    .returning({ id: sessions.id });
  if (!session) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Não foi possível abrir a sessão. Nenhuma sessão foi confirmada. Tente novamente.",
    );
  }
  return { token, sessionId: session.id };
}

function verificationLink(webOrigin: string, token: string): string {
  return `${webOrigin}/verificar-email?token=${encodeURIComponent(token)}`;
}

function resetLink(webOrigin: string, token: string): string {
  return `${webOrigin}/redefinir-senha?token=${encodeURIComponent(token)}`;
}

/** Status público do provider — não revela se o e-mail existe. */
function publicProviderDelivery(provider: EmailProvider): EmailDeliveryStatus {
  return provider.status === "memory" ? "captured" : "not_configured";
}

function neutralAccepted(provider: EmailProvider): {
  status: "accepted";
  emailDelivery: EmailDeliveryStatus;
  message: string;
} {
  const emailDelivery = publicProviderDelivery(provider);
  return {
    status: "accepted",
    emailDelivery,
    message: `${NEUTRAL_ACCOUNT_MESSAGE} ${publicEmailDeliveryMessage(emailDelivery)}`,
  };
}

async function createVerificationToken(
  db: Writer,
  userId: string,
  now = new Date(),
): Promise<string> {
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        isNull(emailVerificationTokens.usedAt),
        gt(emailVerificationTokens.expiresAt, now),
      ),
    );
  const { token, hash } = generateOpaqueToken();
  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash: hash,
    expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
  });
  return token;
}

export async function registerAccount(
  db: AppDatabase,
  input: { displayName: string; email: string; password: string },
  meta: RequestMeta,
  events: InProcessEventBus,
  email: AuthEmailContext,
): Promise<{
  status: "accepted";
  emailDelivery: EmailDeliveryStatus;
  message: string;
}> {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) {
    if (existing.status === "pending_verification" && !existing.emailVerifiedAt) {
      const token = await createVerificationToken(db, existing.id);
      const sent = await email.provider.send({
        kind: "email_verification",
        to: existing.email,
        subject: "Confirme seu e-mail no VerasJuris",
        text: `Confirme seu e-mail: ${verificationLink(email.webOrigin, token)}`,
        token,
      });
      await recordAudit(db, {
        actorUserId: existing.id,
        action: "email.verification_requested",
        resourceType: "user",
        resourceId: existing.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        metadata: { reason: "register_existing_pending", delivery: sent.status },
      });
    }
    return neutralAccepted(email.provider);
  }

  const passwordHash = await hashPassword(input.password);
  let userId = "";
  let rawToken = "";
  try {
    const created = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email,
          passwordHash,
          status: "pending_verification",
        })
        .returning({ id: users.id });
      if (!user) {
        throw new AppError(
          "INTERNAL_ERROR",
          "Não foi possível criar a conta. Nenhuma conta foi registrada. Tente novamente.",
        );
      }
      await tx.insert(profiles).values({ userId: user.id, displayName: input.displayName });
      await tx.insert(professionalProfiles).values({ userId: user.id });
      const token = await createVerificationToken(tx, user.id);
      await recordAudit(tx, {
        actorUserId: user.id,
        action: "user.registered",
        resourceType: "user",
        resourceId: user.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
        after: { status: "pending_verification" },
      });
      await recordAudit(tx, {
        actorUserId: user.id,
        action: "email.verification_requested",
        resourceType: "user",
        resourceId: user.id,
        source: "api",
        requestId: meta.requestId,
        ip: meta.ip,
      });
      return { userId: user.id, token };
    });
    userId = created.userId;
    rawToken = created.token;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return neutralAccepted(email.provider);
    }
    throw error;
  }

  await email.provider.send({
    kind: "email_verification",
    to: input.email,
    subject: "Confirme seu e-mail no VerasJuris",
    text: `Confirme seu e-mail: ${verificationLink(email.webOrigin, rawToken)}`,
    token: rawToken,
  });
  events.publish("auth.registered", { userId, requestId: meta.requestId });
  return neutralAccepted(email.provider);
}

export async function requestEmailVerification(
  db: AppDatabase,
  emailAddress: string,
  meta: RequestMeta,
  email: AuthEmailContext,
): Promise<{ status: "accepted"; emailDelivery: EmailDeliveryStatus; message: string }> {
  const user = await db.query.users.findFirst({ where: eq(users.email, emailAddress) });
  if (user && user.status !== "disabled" && user.status !== "suspended" && !user.emailVerifiedAt) {
    const token = await createVerificationToken(db, user.id);
    const sent = await email.provider.send({
      kind: "email_verification",
      to: user.email,
      subject: "Confirme seu e-mail no VerasJuris",
      text: `Confirme seu e-mail: ${verificationLink(email.webOrigin, token)}`,
      token,
    });
    await recordAudit(db, {
      actorUserId: user.id,
      action: "email.verification_requested",
      resourceType: "user",
      resourceId: user.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { delivery: sent.status },
    });
  }
  return neutralAccepted(email.provider);
}

export async function confirmEmailVerification(
  db: AppDatabase,
  token: string,
  meta: RequestMeta,
): Promise<{ verified: true }> {
  const hash = hashOpaqueToken(token);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      select id from email_verification_tokens
      where token_hash = ${hash}
      for update
    `);
    const row = await tx.query.emailVerificationTokens.findFirst({
      where: eq(emailVerificationTokens.tokenHash, hash),
    });
    if (!row) {
      throw new AppError(
        "AUTHENTICATION_ERROR",
        "Este link de verificação não é válido. Nenhuma alteração foi feita.",
      );
    }
    if (row.usedAt) {
      throw new AppError(
        "CONFLICT",
        "Este link de verificação já foi utilizado. Nenhuma alteração adicional foi feita.",
      );
    }
    if (row.expiresAt <= now) {
      throw new AppError(
        "AUTHENTICATION_ERROR",
        "Este link de verificação expirou. Solicite um novo. Nenhuma alteração foi feita.",
      );
    }
    const user = await tx.query.users.findFirst({ where: eq(users.id, row.userId) });
    if (!user || user.status === "disabled" || user.status === "suspended") {
      throw new AppError(
        "AUTHENTICATION_ERROR",
        "Este link de verificação não é válido. Nenhuma alteração foi feita.",
      );
    }
    if (user.emailVerifiedAt) {
      await tx
        .update(emailVerificationTokens)
        .set({ usedAt: now })
        .where(eq(emailVerificationTokens.id, row.id));
      return;
    }
    await tx
      .update(emailVerificationTokens)
      .set({ usedAt: now })
      .where(eq(emailVerificationTokens.id, row.id));
    await tx
      .update(users)
      .set({
        status: "active",
        emailVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));
    await recordAudit(tx, {
      actorUserId: user.id,
      action: "email.verified",
      resourceType: "user",
      resourceId: user.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      after: { status: "active", emailVerified: true },
    });
  });
  return { verified: true };
}

export async function loginAccount(
  db: AppDatabase,
  input: { email: string; password: string },
  meta: RequestMeta,
  events: InProcessEventBus,
): Promise<{ token: string; account: ReturnType<typeof toPublicSession> }> {
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  const matches = await verifyPasswordOrDummy(input.password, user?.passwordHash ?? null);
  const eligible =
    Boolean(user) && matches && user?.status === "active" && Boolean(user.emailVerifiedAt);
  if (!eligible || !user) {
    await recordAudit(db, {
      actorUserId: user?.id ?? null,
      action: "auth.login_failed",
      resourceType: "session",
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { method: "password", result: "rejected" },
    });
    throw new AppError("AUTHENTICATION_ERROR", LOGIN_FAILURE_MESSAGE);
  }
  const now = new Date();
  const issued = await db.transaction(async (tx) => {
    const session = await issueSession(tx, user.id, meta, now);
    await tx.update(users).set({ lastLoginAt: now, updatedAt: now }).where(eq(users.id, user.id));
    await recordAudit(tx, {
      actorUserId: user.id,
      action: "auth.login_succeeded",
      resourceType: "session",
      resourceId: session.sessionId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { method: "password" },
    });
    return session;
  });
  const account = await findSession(db, issued.token);
  if (!account) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Não foi possível abrir a sessão. Nenhuma sessão foi confirmada. Tente novamente.",
    );
  }
  events.publish("auth.login_succeeded", { userId: user.id, requestId: meta.requestId });
  return { token: issued.token, account: toPublicSession(account) };
}

export async function logoutAccount(
  db: AppDatabase,
  account: SessionAccount | null,
  meta: RequestMeta,
): Promise<void> {
  if (!account) return;
  await db.transaction(async (tx) => {
    await revokeSession(tx, account.sessionId);
    await recordAudit(tx, {
      actorUserId: account.user.id,
      action: "auth.logout",
      resourceType: "session",
      resourceId: account.sessionId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
    });
  });
}

export async function requestPasswordReset(
  db: AppDatabase,
  emailAddress: string,
  meta: RequestMeta,
  email: AuthEmailContext,
): Promise<{ status: "accepted"; emailDelivery: EmailDeliveryStatus; message: string }> {
  const user = await db.query.users.findFirst({ where: eq(users.email, emailAddress) });
  if (user && user.status === "active" && user.emailVerifiedAt) {
    const now = new Date();
    await db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      );
    const { token, hash } = generateOpaqueToken();
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
    });
    const sent = await email.provider.send({
      kind: "password_reset",
      to: user.email,
      subject: "Redefinição de senha no VerasJuris",
      text: `Redefina sua senha: ${resetLink(email.webOrigin, token)}`,
      token,
    });
    await recordAudit(db, {
      actorUserId: user.id,
      action: "password.reset_requested",
      resourceType: "user",
      resourceId: user.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { delivery: sent.status },
    });
  }
  return neutralAccepted(email.provider);
}

export async function confirmPasswordReset(
  db: AppDatabase,
  input: { token: string; password: string },
  meta: RequestMeta,
): Promise<{ reset: true }> {
  const hash = hashOpaqueToken(input.token);
  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      select id from password_reset_tokens
      where token_hash = ${hash}
      for update
    `);
    const row = await tx.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.tokenHash, hash),
    });
    if (!row || row.usedAt || row.expiresAt <= now) {
      throw new AppError(
        "AUTHENTICATION_ERROR",
        "Este link de redefinição não é válido ou expirou. Nenhuma senha foi alterada.",
      );
    }
    const user = await tx.query.users.findFirst({ where: eq(users.id, row.userId) });
    const activeUser = user?.status === "active" ? user : null;
    if (!activeUser) {
      throw new AppError(
        "AUTHENTICATION_ERROR",
        "Este link de redefinição não é válido ou expirou. Nenhuma senha foi alterada.",
      );
    }
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, row.id));
    await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, activeUser.id));
    await revokeAllUserSessions(tx, activeUser.id, now);
    await recordAudit(tx, {
      actorUserId: activeUser.id,
      action: "password.reset_completed",
      resourceType: "user",
      resourceId: activeUser.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { sessionsRevoked: true },
    });
  });
  return { reset: true };
}

export async function changePassword(
  db: AppDatabase,
  account: SessionAccount,
  input: { currentPassword: string; newPassword: string },
  meta: RequestMeta,
): Promise<{ changed: true }> {
  const user = await db.query.users.findFirst({ where: eq(users.id, account.user.id) });
  if (!user) {
    throw new AppError(
      "AUTHENTICATION_ERROR",
      "Entre para continuar. Nenhuma alteração foi feita.",
    );
  }
  const matches = await verifyPasswordOrDummy(input.currentPassword, user.passwordHash);
  if (!matches) {
    throw new AppError(
      "AUTHENTICATION_ERROR",
      "A senha atual não confere. Nenhuma alteração foi feita.",
    );
  }
  const passwordHash = await hashPassword(input.newPassword);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, user.id));
    await revokeOtherSessions(tx, user.id, account.sessionId, now);
    await recordAudit(tx, {
      actorUserId: user.id,
      action: "password.changed",
      resourceType: "user",
      resourceId: user.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { otherSessionsRevoked: true },
    });
  });
  return { changed: true };
}

export async function listSessions(db: AppDatabase, account: SessionAccount) {
  const now = new Date();
  const rows = await db.query.sessions.findMany({
    where: and(
      eq(sessions.userId, account.user.id),
      isNull(sessions.revokedAt),
      gt(sessions.expiresAt, now),
    ),
    orderBy: [desc(sessions.createdAt)],
  });
  return rows.map((row) => ({
    id: row.id,
    current: row.id === account.sessionId,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? row.createdAt.toISOString(),
    ipHint: row.ip ? `${row.ip.split(".").slice(0, 2).join(".")}.*` : null,
    userAgentHint: row.userAgent ? row.userAgent.slice(0, 48) : null,
  }));
}

export async function updateProfile(
  db: AppDatabase,
  account: SessionAccount,
  input: { displayName: string; locale: string; timeZone: string },
  meta: RequestMeta,
) {
  const before = {
    displayName: account.user.displayName,
    locale: account.user.locale,
    timeZone: account.user.timeZone,
  };
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({
        displayName: input.displayName,
        locale: input.locale,
        timeZone: input.timeZone,
        updatedAt: now,
      })
      .where(eq(profiles.userId, account.user.id));
    await recordAudit(tx, {
      actorUserId: account.user.id,
      action: "profile.updated",
      resourceType: "profile",
      resourceId: account.user.id,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      before,
      after: input,
    });
  });
  return {
    profile: {
      displayName: input.displayName,
      locale: input.locale,
      timeZone: input.timeZone,
    },
  };
}

export async function revokeOwnSession(
  db: AppDatabase,
  account: SessionAccount,
  sessionId: string,
  meta: RequestMeta,
): Promise<void> {
  const row = await db.query.sessions.findFirst({
    where: and(eq(sessions.id, sessionId), eq(sessions.userId, account.user.id)),
  });
  if (!row || row.revokedAt) {
    throw new AppError("NOT_FOUND", "Não encontramos esta sessão no seu acesso.");
  }
  await db.transaction(async (tx) => {
    await revokeSession(tx, sessionId);
    await recordAudit(tx, {
      actorUserId: account.user.id,
      action: "session.revoked",
      resourceType: "session",
      resourceId: sessionId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { current: sessionId === account.sessionId },
    });
  });
}

export async function revokeOtherOwnSessions(
  db: AppDatabase,
  account: SessionAccount,
  meta: RequestMeta,
): Promise<void> {
  await db.transaction(async (tx) => {
    await revokeOtherSessions(tx, account.user.id, account.sessionId);
    await recordAudit(tx, {
      actorUserId: account.user.id,
      action: "session.revoked",
      resourceType: "session",
      resourceId: account.sessionId,
      source: "api",
      requestId: meta.requestId,
      ip: meta.ip,
      metadata: { scope: "others" },
    });
  });
}

export type { EmailDeliveryStatus };
