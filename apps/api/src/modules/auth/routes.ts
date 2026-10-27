import type {
  AIGateway,
  AuctionBidProvider,
  AuctionProvider,
  CitationEngine,
  CNISProvider,
  ESocialProvider,
  FGTSProvider,
  LaborCourtProvider,
  OCRProvider,
  PublicOpportunityProvider,
  ResearchGateway,
  SocialSecurityProvider,
  TimeTrackingImportProvider,
} from "@verasjuris/ai";
import {
  authorizeAccess,
  findSession,
  toPublicSession,
  type SessionAccount,
} from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import type { EmailProvider } from "@verasjuris/email";
import type { InProcessEventBus } from "@verasjuris/events";
import { type MemoryRateLimiter, SESSION_COOKIE, SESSION_TTL_MS } from "@verasjuris/security";
import type { HolidayCalendarProvider, NotificationProvider } from "@verasjuris/notifications";
import type { MalwareScannerProvider, StorageProvider } from "@verasjuris/storage";
import { AppError, type PermissionKey } from "@verasjuris/types";
import {
  changePasswordSchema,
  confirmTokenSchema,
  emailOnlySchema,
  loginSchema,
  parseInput,
  passwordResetConfirmSchema,
  registerSchema,
  updateProfileSchema,
  uuidSchema,
} from "@verasjuris/validation";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  changePassword,
  confirmEmailVerification,
  confirmPasswordReset,
  listSessions,
  loginAccount,
  logoutAccount,
  registerAccount,
  requestEmailVerification,
  requestPasswordReset,
  revokeOtherOwnSessions,
  revokeOwnSession,
  updateProfile,
  type AuthEmailContext,
  type RequestMeta,
} from "./service.js";

export type ApiDeps = {
  db: AppDatabase;
  events: InProcessEventBus;
  rateLimiter: MemoryRateLimiter;
  secureCookies: boolean;
  email: EmailProvider;
  webOrigin: string;
  storage?: StorageProvider;
  malwareScanner?: MalwareScannerProvider;
  documentMaxUploadBytes?: number;
  notifications?: NotificationProvider;
  holidays?: HolidayCalendarProvider;
  /** Toda IA passa pelo gateway; ausente = NOT_CONFIGURED. */
  aiGateway?: AIGateway;
  /** OCR é opcional; ausente = NOT_CONFIGURED (nunca simulado). */
  ocrProvider?: OCRProvider;
  /** Fonte externa de oportunidades públicas; ausente = NOT_CONFIGURED (cadastro manual segue ativo). */
  publicOpportunityProvider?: PublicOpportunityProvider;
  /** Pesquisa jurídica via fontes verificáveis; ausente = NOT_CONFIGURED (catálogo local vazio ok). */
  researchGateway?: ResearchGateway;
  /** Motor de citação; ausente = CitationEngine padrão (nunca marca verified sozinho). */
  citationEngine?: CitationEngine;
  /** Fonte externa de leilões; ausente = NOT_CONFIGURED (cadastro manual segue ativo). */
  auctionProvider?: AuctionProvider;
  /** Lance eletrônico; ausente = NOT_CONFIGURED (API nunca afirma que o usuário está dando lance). */
  auctionBidProvider?: AuctionBidProvider;
  /** eSocial; ausente = NOT_CONFIGURED. */
  eSocialProvider?: ESocialProvider;
  /** FGTS; ausente = NOT_CONFIGURED (nunca saldo oficial). */
  fgtsProvider?: FGTSProvider;
  /** Tribunal trabalhista; ausente = NOT_CONFIGURED (sem scraping). */
  laborCourtProvider?: LaborCourtProvider;
  /** Importação de ponto; ausente = NOT_CONFIGURED (cadastro manual ativo). */
  timeTrackingImportProvider?: TimeTrackingImportProvider;
  /** Dados oficiais previdenciários; ausente = NOT_CONFIGURED (cadastro/import manual segue ativo). */
  socialSecurityProvider?: SocialSecurityProvider;
  /** CNIS externo; ausente = NOT_CONFIGURED (importação manual estruturada segue ativa). */
  cnisProvider?: CNISProvider;
};

function meta(request: FastifyRequest): RequestMeta {
  const forwarded = request.ip?.replace(/[\r\n]/g, "").slice(0, 64);
  const userAgentHeader = request.headers["user-agent"];
  const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;
  return {
    requestId: request.id,
    ip: forwarded || null,
    userAgent: userAgent?.replace(/[\r\n]/g, "").slice(0, 200) ?? null,
  };
}

function emailContext(deps: ApiDeps): AuthEmailContext {
  return { provider: deps.email, webOrigin: deps.webOrigin };
}

function cookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export async function readAccount(
  deps: ApiDeps,
  request: FastifyRequest,
): Promise<SessionAccount | null> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  return findSession(deps.db, token);
}

export async function requireAccount(
  deps: ApiDeps,
  request: FastifyRequest,
): Promise<SessionAccount> {
  const account = await readAccount(deps, request);
  if (!account) {
    throw new AppError(
      "AUTHENTICATION_ERROR",
      "Entre para continuar. Nenhuma alteração foi feita.",
    );
  }
  return account;
}

export function requireOrganizationPermission(
  account: SessionAccount,
  organizationId: string,
  permission: PermissionKey,
): SessionAccount["memberships"][number] {
  const membership =
    account.memberships.find((item) => item.organizationId === organizationId) ?? null;
  const decision = authorizeAccess({
    membership: membership
      ? {
          status: membership.membershipStatus,
          organizationStatus: membership.organizationStatus,
          permissions: membership.permissions,
          roles: membership.roles,
        }
      : null,
    required: permission,
  });
  if (!decision.ok) throw new AppError(decision.code, decision.message);
  return membership as SessionAccount["memberships"][number];
}

function setSessionCookie(reply: FastifyReply, token: string, secure: boolean): void {
  reply.setCookie(SESSION_COOKIE, token, cookieOptions(secure));
}

export async function registerAuthRoutes(app: FastifyInstance, deps: ApiDeps): Promise<void> {
  app.post("/auth/register", async (request, reply) => {
    const limit = deps.rateLimiter.consume(
      `register:${meta(request).ip ?? "unknown"}`,
      10,
      15 * 60 * 1000,
    );
    if (!limit.allowed) {
      reply.header("retry-after", String(limit.retryAfterSeconds));
      throw new AppError(
        "RATE_LIMIT",
        "Houve tentativas demais em pouco tempo. Aguarde alguns minutos. Nenhuma conta foi criada.",
      );
    }
    const input = parseInput(registerSchema, request.body);
    const result = await registerAccount(
      deps.db,
      input,
      meta(request),
      deps.events,
      emailContext(deps),
    );
    return reply.status(201).send(result);
  });

  app.post("/auth/login", async (request, reply) => {
    const body = parseInput(loginSchema, request.body ?? {});
    const limit = deps.rateLimiter.consume(`login:${body.email}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) {
      reply.header("retry-after", String(limit.retryAfterSeconds));
      throw new AppError(
        "RATE_LIMIT",
        "Houve tentativas demais em pouco tempo. Aguarde alguns minutos. Nenhuma sessão foi aberta.",
      );
    }
    const result = await loginAccount(deps.db, body, meta(request), deps.events);
    setSessionCookie(reply, result.token, deps.secureCookies);
    return reply.send({ account: result.account });
  });

  app.post("/auth/logout", async (request, reply) => {
    const account = await readAccount(deps, request);
    await logoutAccount(deps.db, account, meta(request));
    reply.clearCookie(SESSION_COOKIE, cookieOptions(deps.secureCookies));
    return reply.status(204).send();
  });

  app.get("/auth/session", async (request, reply) => {
    const account = await readAccount(deps, request);
    if (!account) {
      throw new AppError("AUTHENTICATION_ERROR", "Não há uma sessão ativa.");
    }
    return reply.send({ account: toPublicSession(account) });
  });

  app.post("/auth/email-verification/request", async (request, reply) => {
    const body = parseInput(emailOnlySchema, request.body ?? {});
    const limit = deps.rateLimiter.consume(`email-verify:${body.email}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      reply.header("retry-after", String(limit.retryAfterSeconds));
      throw new AppError(
        "RATE_LIMIT",
        "Houve tentativas demais em pouco tempo. Aguarde alguns minutos. Nenhuma solicitação foi registrada.",
      );
    }
    const result = await requestEmailVerification(
      deps.db,
      body.email,
      meta(request),
      emailContext(deps),
    );
    return reply.send(result);
  });

  app.post("/auth/email-verification/confirm", async (request, reply) => {
    const body = parseInput(confirmTokenSchema, request.body ?? {});
    const result = await confirmEmailVerification(deps.db, body.token, meta(request));
    return reply.send(result);
  });

  app.post("/auth/password-reset/request", async (request, reply) => {
    const body = parseInput(emailOnlySchema, request.body ?? {});
    const limit = deps.rateLimiter.consume(`password-reset:${body.email}`, 5, 15 * 60 * 1000);
    if (!limit.allowed) {
      reply.header("retry-after", String(limit.retryAfterSeconds));
      throw new AppError(
        "RATE_LIMIT",
        "Houve tentativas demais em pouco tempo. Aguarde alguns minutos. Nenhuma solicitação foi registrada.",
      );
    }
    const result = await requestPasswordReset(
      deps.db,
      body.email,
      meta(request),
      emailContext(deps),
    );
    return reply.send(result);
  });

  app.post("/auth/password-reset/confirm", async (request, reply) => {
    const body = parseInput(passwordResetConfirmSchema, request.body ?? {});
    const result = await confirmPasswordReset(deps.db, body, meta(request));
    return reply.send(result);
  });

  app.post("/auth/password/change", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(changePasswordSchema, request.body ?? {});
    const result = await changePassword(deps.db, account, body, meta(request));
    return reply.send(result);
  });

  app.patch("/account/profile", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(updateProfileSchema, request.body ?? {});
    const result = await updateProfile(deps.db, account, body, meta(request));
    return reply.send(result);
  });

  app.get("/account/profile", async (request, reply) => {
    const account = await requireAccount(deps, request);
    return reply.send({
      profile: {
        displayName: account.user.displayName,
        locale: account.user.locale,
        timeZone: account.user.timeZone,
        email: account.user.email,
      },
    });
  });

  app.get("/sessions", async (request, reply) => {
    const account = await requireAccount(deps, request);
    return reply.send({ sessions: await listSessions(deps.db, account) });
  });

  app.delete("/sessions/:sessionId", async (request, reply) => {
    const account = await requireAccount(deps, request);
    const params = request.params as { sessionId?: string };
    const sessionId = parseInput(uuidSchema, params.sessionId);
    await revokeOwnSession(deps.db, account, sessionId, meta(request));
    if (sessionId === account.sessionId) {
      reply.clearCookie(SESSION_COOKIE, cookieOptions(deps.secureCookies));
    }
    return reply.status(204).send();
  });

  app.post("/sessions/revoke-others", async (request, reply) => {
    const account = await requireAccount(deps, request);
    await revokeOtherOwnSessions(deps.db, account, meta(request));
    return reply.send({ revoked: true });
  });
}

export { meta };
