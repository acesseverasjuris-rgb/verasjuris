import {
  EmailCommunicationChannel,
  NotConfiguredEmailProvider,
  NotConfiguredPushProvider,
  NotConfiguredSmsProvider,
  NotConfiguredWhatsAppProvider,
  PushCommunicationChannel,
  SmsCommunicationChannel,
  WhatsAppCommunicationChannel,
  type EmailProvider,
  type PushProvider,
  type SmsProvider,
  type WhatsAppProvider,
} from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyCommunication,
  policyCommunicationConsent,
  policyCommunicationPreference,
  policyCommunicationTemplate,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  communicationConsents,
  communicationMessageHistory,
  communicationMessages,
  communicationOutbox,
  communicationPreferences,
  communicationTemplateVersions,
  communicationTemplates,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, desc, eq } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";
import {
  isTransientCommunicationError,
  processCommunicationOutboxEntry,
  type CommunicationDispatchDeps,
} from "./dispatch.js";

export type CommunicationModuleDeps = CommunicationDispatchDeps;

export function communicationModuleDeps(deps: {
  communicationEmailProvider?: EmailProvider;
  communicationSmsProvider?: SmsProvider;
  communicationWhatsappProvider?: WhatsAppProvider;
  communicationPushProvider?: PushProvider;
}): CommunicationModuleDeps {
  return {
    channels: {
      email: new EmailCommunicationChannel(
        deps.communicationEmailProvider ?? new NotConfiguredEmailProvider(),
      ),
      sms: new SmsCommunicationChannel(
        deps.communicationSmsProvider ?? new NotConfiguredSmsProvider(),
      ),
      whatsapp: new WhatsAppCommunicationChannel(
        deps.communicationWhatsappProvider ?? new NotConfiguredWhatsAppProvider(),
      ),
      push: new PushCommunicationChannel(
        deps.communicationPushProvider ?? new NotConfiguredPushProvider(),
      ),
    },
  };
}

const MARKETING_CATEGORY = "marketing" as const;

/** Substituição segura {{var}} — sem eval; apenas chaves permitidas. */
export function substituteTemplateVariables(
  template: string,
  variables: Record<string, string>,
  whitelist?: string[],
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (full, key: string) => {
    if (whitelist && !whitelist.includes(key)) {
      throw new AppError("VALIDATION_ERROR", "Variável de template não permitida.", [
        { path: `variables.${key}`, message: "Fora do schema do template." },
      ]);
    }
    if (!(key in variables)) {
      throw new AppError("VALIDATION_ERROR", "Variável de template ausente.", [
        { path: `variables.${key}`, message: "Informe um valor." },
      ]);
    }
    return variables[key] ?? "";
  });
}

function variableWhitelist(
  schema: Record<string, unknown> | null | undefined,
): string[] | undefined {
  if (!schema || typeof schema !== "object") return undefined;
  return Object.keys(schema);
}

function parseHm(value: string): number {
  const parts = value.split(":");
  const h = Number.parseInt(parts[0] ?? "", 10);
  const m = Number.parseInt(parts[1] ?? "", 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

function isInQuietHours(now: Date, start: string, end: string): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  const s = parseHm(start);
  const e = parseHm(end);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return false;
  if (s <= e) return mins >= s && mins < e;
  return mins >= s || mins < e;
}

function nextAttemptAfterQuietHours(now: Date, quietEnd: string): Date {
  const endMins = parseHm(quietEnd);
  if (!Number.isFinite(endMins)) return now;
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setHours(Math.floor(endMins / 60), endMins % 60, 0, 0);
  if (candidate.getTime() <= now.getTime()) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

async function auditCommunication(
  db: AppDatabase,
  account: SessionAccount | null,
  organizationId: string,
  action: string,
  resourceId: string,
  meta: RequestMeta,
  after?: Record<string, unknown>,
) {
  await recordAudit(db, {
    actorUserId: account?.user.id ?? null,
    organizationId,
    action,
    resourceType: "communication_message",
    resourceId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: after ?? null,
  });
}

async function appendHistory(
  db: AppDatabase,
  input: {
    organizationId: string;
    messageId: string;
    fromStatus: string | null;
    toStatus: string;
    detail?: string;
  },
) {
  await db.insert(communicationMessageHistory).values({
    organizationId: input.organizationId,
    messageId: input.messageId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    detail: input.detail ?? null,
  });
}

async function findConsent(
  db: AppDatabase,
  organizationId: string,
  subjectType: string,
  subjectId: string,
  channel: (typeof communicationMessages.$inferSelect)["channel"],
  category: (typeof communicationMessages.$inferSelect)["category"],
) {
  const rows = await db.query.communicationConsents.findMany({
    where: and(
      eq(communicationConsents.organizationId, organizationId),
      eq(communicationConsents.subjectType, subjectType),
      eq(communicationConsents.subjectId, subjectId),
      eq(communicationConsents.channel, channel),
      eq(communicationConsents.category, category),
    ),
    orderBy: [desc(communicationConsents.createdAt)],
    limit: 1,
  });
  return rows[0];
}

async function findPreference(
  db: AppDatabase,
  organizationId: string,
  userId: string,
  channel: (typeof communicationMessages.$inferSelect)["channel"],
  category: (typeof communicationMessages.$inferSelect)["category"],
) {
  return db.query.communicationPreferences.findFirst({
    where: and(
      eq(communicationPreferences.organizationId, organizationId),
      eq(communicationPreferences.userId, userId),
      eq(communicationPreferences.channel, channel),
      eq(communicationPreferences.category, category),
    ),
  });
}

/**
 * Marketing opt-out bloqueia categoria marketing.
 * Comunicações transacionais/operacionais podem seguir mesmo com opt-out de marketing (LGPD: serviço vs promoção).
 */
async function assertSendAllowed(
  db: AppDatabase,
  input: {
    organizationId: string;
    recipientType: string;
    recipientId: string;
    channel: (typeof communicationMessages.$inferSelect)["channel"];
    category: (typeof communicationMessages.$inferSelect)["category"];
  },
) {
  if (input.category === MARKETING_CATEGORY) {
    const consent = await findConsent(
      db,
      input.organizationId,
      input.recipientType,
      input.recipientId,
      input.channel,
      MARKETING_CATEGORY,
    );
    if (consent?.status === "opted_out") {
      throw new AppError(
        "AUTHORIZATION_ERROR",
        "Destinatário optou por não receber comunicações de marketing.",
      );
    }
  }

  if (input.recipientType === "user" && input.category !== "security") {
    const pref = await findPreference(
      db,
      input.organizationId,
      input.recipientId,
      input.channel,
      input.category,
    );
    if (pref && !pref.enabled) {
      throw new AppError(
        "AUTHORIZATION_ERROR",
        "Preferências do destinatário bloqueiam este canal/categoria.",
      );
    }
  }
}

function computeInitialNextAttemptAt(
  preference: typeof communicationPreferences.$inferSelect | null | undefined,
  category: (typeof communicationMessages.$inferSelect)["category"],
  scheduledAt?: string,
): Date {
  const now = new Date();
  let base = scheduledAt ? new Date(scheduledAt) : now;
  if (Number.isNaN(base.getTime())) base = now;
  if (category === "security") return base;
  if (!preference?.quietHoursStart || !preference?.quietHoursEnd) return base;
  if (!isInQuietHours(now, preference.quietHoursStart, preference.quietHoursEnd)) return base;
  return nextAttemptAfterQuietHours(now, preference.quietHoursEnd);
}

function serializeTemplate(row: typeof communicationTemplates.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    scope: row.scope,
    channel: row.channel,
    key: row.key,
    name: row.name,
    subjectTemplate: row.subjectTemplate,
    bodyTemplate: row.bodyTemplate,
    variableSchema: row.variableSchema ?? null,
    category: row.category,
    active: row.active,
    currentVersionId: row.currentVersionId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function serializeMessage(row: typeof communicationMessages.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    recipientType: row.recipientType,
    recipientId: row.recipientId,
    channel: row.channel,
    category: row.category,
    templateVersionId: row.templateVersionId,
    subject: row.subject,
    bodySnapshot: row.bodySnapshot,
    status: row.status,
    providerKey: row.providerKey,
    externalMessageId: row.externalMessageId,
    idempotencyKey: row.idempotencyKey,
    scheduledAt: iso(row.scheduledAt),
    sentAt: iso(row.sentAt),
    deliveredAt: iso(row.deliveredAt),
    failedAt: iso(row.failedAt),
    errorCode: row.errorCode,
    attemptCount: row.attemptCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getCommunicationProvidersStatus(
  account: SessionAccount,
  organizationId: string,
  deps: CommunicationModuleDeps,
) {
  authorize(account, organizationId, (access) => policyCommunication(access, "communication.read"));
  const [email, sms, whatsapp, push] = await Promise.all([
    deps.channels.email.healthCheck(),
    deps.channels.sms.healthCheck(),
    deps.channels.whatsapp.healthCheck(),
    deps.channels.push.healthCheck(),
  ]);
  return {
    inApp: { status: "ok" as const, channel: "in_app" as const },
    email,
    sms,
    whatsapp,
    push,
  };
}

export async function listCommunicationTemplates(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { channel?: string; limit: number; offset: number },
) {
  authorize(account, organizationId, (access) =>
    policyCommunicationTemplate(access, "communication.read"),
  );
  const rows = await db.query.communicationTemplates.findMany({
    where: and(
      eq(communicationTemplates.organizationId, organizationId),
      query.channel ? eq(communicationTemplates.channel, query.channel as never) : undefined,
    ),
    limit: query.limit,
    offset: query.offset,
    orderBy: [desc(communicationTemplates.updatedAt)],
  });
  return { items: rows.map(serializeTemplate) };
}

export async function createCommunicationTemplate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    scope?: string;
    channel: (typeof communicationTemplates.$inferSelect)["channel"];
    key: string;
    name: string;
    subjectTemplate?: string;
    bodyTemplate: string;
    variableSchema?: Record<string, unknown>;
    category?: (typeof communicationTemplates.$inferSelect)["category"];
    active?: boolean;
  },
  _meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyCommunicationTemplate(access, "communication.manage_templates"),
  );
  const [row] = await db
    .insert(communicationTemplates)
    .values({
      organizationId,
      scope: input.scope ?? "organization",
      channel: input.channel as never,
      key: input.key,
      name: input.name,
      subjectTemplate: input.subjectTemplate ?? null,
      bodyTemplate: input.bodyTemplate,
      variableSchema: input.variableSchema ?? null,
      category: (input.category ?? "system") as never,
      active: input.active ?? true,
    })
    .returning();
  if (!row) throw new AppError("INTERNAL_ERROR", "Não foi possível criar o template.");
  return { template: serializeTemplate(row) };
}

export async function getCommunicationTemplate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
) {
  authorize(account, organizationId, (access) =>
    policyCommunicationTemplate(access, "communication.read"),
  );
  const row = await db.query.communicationTemplates.findFirst({
    where: and(
      eq(communicationTemplates.id, templateId),
      eq(communicationTemplates.organizationId, organizationId),
    ),
  });
  if (!row) throw new AppError("NOT_FOUND", "Template não encontrado.");
  return { template: serializeTemplate(row) };
}

export async function updateCommunicationTemplate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
  patch: Partial<typeof communicationTemplates.$inferInsert>,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyCommunicationTemplate(access, "communication.manage_templates"),
  );
  const existing = await db.query.communicationTemplates.findFirst({
    where: and(
      eq(communicationTemplates.id, templateId),
      eq(communicationTemplates.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Template não encontrado.");

  const [row] = await db
    .update(communicationTemplates)
    .set({
      ...patch,
      updatedAt: new Date(),
    })
    .where(eq(communicationTemplates.id, templateId))
    .returning();
  return { template: serializeTemplate(row!) };
}

export async function deleteCommunicationTemplate(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
) {
  authorize(account, organizationId, (access) =>
    policyCommunicationTemplate(access, "communication.manage_templates"),
  );
  const existing = await db.query.communicationTemplates.findFirst({
    where: and(
      eq(communicationTemplates.id, templateId),
      eq(communicationTemplates.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Template não encontrado.");
  await db.delete(communicationTemplates).where(eq(communicationTemplates.id, templateId));
  return { ok: true as const };
}

export async function listCommunicationTemplateVersions(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
) {
  authorize(account, organizationId, (access) =>
    policyCommunicationTemplate(access, "communication.read"),
  );
  const template = await db.query.communicationTemplates.findFirst({
    where: and(
      eq(communicationTemplates.id, templateId),
      eq(communicationTemplates.organizationId, organizationId),
    ),
  });
  if (!template) throw new AppError("NOT_FOUND", "Template não encontrado.");
  const versions = await db.query.communicationTemplateVersions.findMany({
    where: eq(communicationTemplateVersions.templateId, templateId),
    orderBy: [desc(communicationTemplateVersions.version)],
  });
  return {
    items: versions.map((v) => ({
      id: v.id,
      templateId: v.templateId,
      version: v.version,
      subjectTemplate: v.subjectTemplate,
      bodyTemplate: v.bodyTemplate,
      variableSchema: v.variableSchema ?? null,
      locked: v.locked,
      createdAt: v.createdAt.toISOString(),
    })),
  };
}

export async function createCommunicationTemplateVersion(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  templateId: string,
  input: {
    version: number;
    subjectTemplate?: string;
    bodyTemplate: string;
    variableSchema?: Record<string, unknown>;
    locked?: boolean;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyCommunicationTemplate(access, "communication.manage_templates"),
  );
  const template = await db.query.communicationTemplates.findFirst({
    where: and(
      eq(communicationTemplates.id, templateId),
      eq(communicationTemplates.organizationId, organizationId),
    ),
  });
  if (!template) throw new AppError("NOT_FOUND", "Template não encontrado.");

  const [version] = await db
    .insert(communicationTemplateVersions)
    .values({
      templateId,
      version: input.version,
      subjectTemplate: input.subjectTemplate ?? null,
      bodyTemplate: input.bodyTemplate,
      variableSchema: input.variableSchema ?? null,
      locked: input.locked ?? false,
    })
    .returning();

  await db
    .update(communicationTemplates)
    .set({ currentVersionId: version!.id, updatedAt: new Date() })
    .where(eq(communicationTemplates.id, templateId));

  return {
    version: {
      id: version!.id,
      templateId,
      version: version!.version,
      subjectTemplate: version!.subjectTemplate,
      bodyTemplate: version!.bodyTemplate,
      variableSchema: version!.variableSchema ?? null,
      locked: version!.locked,
      createdAt: version!.createdAt.toISOString(),
    },
  };
}

export async function listCommunicationPreferences(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { userId?: string },
) {
  authorize(account, organizationId, (access) =>
    policyCommunicationPreference(access, "communication.read"),
  );
  const rows = await db.query.communicationPreferences.findMany({
    where: and(
      eq(communicationPreferences.organizationId, organizationId),
      query.userId ? eq(communicationPreferences.userId, query.userId) : undefined,
    ),
    orderBy: [asc(communicationPreferences.channel), asc(communicationPreferences.category)],
  });
  return {
    items: rows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      channel: row.channel,
      category: row.category,
      enabled: row.enabled,
      quietHoursStart: row.quietHoursStart,
      quietHoursEnd: row.quietHoursEnd,
      language: row.language,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })),
  };
}

export async function createCommunicationPreference(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    userId: string;
    channel: (typeof communicationPreferences.$inferSelect)["channel"];
    category: (typeof communicationPreferences.$inferSelect)["category"];
    enabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    language?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyCommunicationPreference(access, "communication.manage_preferences"),
  );
  const [row] = await db
    .insert(communicationPreferences)
    .values({
      organizationId,
      userId: input.userId,
      channel: input.channel,
      category: input.category,
      enabled: input.enabled ?? true,
      quietHoursStart: input.quietHoursStart ?? null,
      quietHoursEnd: input.quietHoursEnd ?? null,
      language: input.language ?? "pt-BR",
    })
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "communication.preference_changed",
    resourceType: "communication_preference",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { enabled: row!.enabled, channel: row!.channel, category: row!.category },
  });
  return { preference: row };
}

export async function updateCommunicationPreference(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  preferenceId: string,
  patch: {
    enabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    language?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyCommunicationPreference(access, "communication.manage_preferences"),
  );
  const existing = await db.query.communicationPreferences.findFirst({
    where: and(
      eq(communicationPreferences.id, preferenceId),
      eq(communicationPreferences.organizationId, organizationId),
    ),
  });
  if (!existing) throw new AppError("NOT_FOUND", "Preferência não encontrada.");
  const [row] = await db
    .update(communicationPreferences)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(communicationPreferences.id, preferenceId))
    .returning();
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action: "communication.preference_changed",
    resourceType: "communication_preference",
    resourceId: preferenceId,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: patch,
  });
  return { preference: row };
}

export async function listCommunicationConsents(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: { subjectType?: string; subjectId?: string },
) {
  authorize(account, organizationId, (access) =>
    policyCommunicationConsent(access, "communication.read"),
  );
  const rows = await db.query.communicationConsents.findMany({
    where: and(
      eq(communicationConsents.organizationId, organizationId),
      query.subjectType ? eq(communicationConsents.subjectType, query.subjectType) : undefined,
      query.subjectId ? eq(communicationConsents.subjectId, query.subjectId) : undefined,
    ),
    orderBy: [desc(communicationConsents.createdAt)],
    limit: 100,
  });
  return { items: rows };
}

export async function upsertCommunicationConsent(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    subjectType: string;
    subjectId: string;
    channel: (typeof communicationConsents.$inferSelect)["channel"];
    category: (typeof communicationConsents.$inferSelect)["category"];
    status: (typeof communicationConsents.$inferSelect)["status"];
    source?: string;
    grantedAt?: string;
    revokedAt?: string;
    evidence?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyCommunicationConsent(access, "communication.manage_consents"),
  );
  const [row] = await db
    .insert(communicationConsents)
    .values({
      organizationId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      channel: input.channel,
      category: input.category,
      status: input.status,
      source: input.source ?? "manual",
      grantedAt: input.grantedAt ? new Date(input.grantedAt) : null,
      revokedAt: input.revokedAt ? new Date(input.revokedAt) : null,
      evidence: input.evidence ?? null,
    })
    .returning();

  const action =
    input.status === "opted_out"
      ? "communication.opt_out"
      : input.status === "opted_in"
        ? "communication.opt_in"
        : "communication.preference_changed";
  await recordAudit(db, {
    actorUserId: account.user.id,
    organizationId,
    action,
    resourceType: "communication_consent",
    resourceId: row!.id,
    source: "api",
    requestId: meta.requestId,
    ip: meta.ip,
    after: { status: input.status, channel: input.channel, category: input.category },
  });
  return { consent: row };
}

async function resolveMessageBody(
  db: AppDatabase,
  organizationId: string,
  input: {
    templateVersionId?: string;
    bodySnapshot?: string;
    subject?: string;
    variables?: Record<string, string>;
  },
): Promise<{ subject: string | null; bodySnapshot: string }> {
  if (!input.templateVersionId) {
    if (!input.bodySnapshot?.trim()) {
      throw new AppError("VALIDATION_ERROR", "Informe bodySnapshot ou templateVersionId.");
    }
    return { subject: input.subject ?? null, bodySnapshot: input.bodySnapshot.trim() };
  }
  const version = await db.query.communicationTemplateVersions.findFirst({
    where: eq(communicationTemplateVersions.id, input.templateVersionId),
    with: { template: true },
  });
  if (!version?.template || version.template.organizationId !== organizationId) {
    throw new AppError("NOT_FOUND", "Versão de template não encontrada.");
  }
  const whitelist = variableWhitelist(version.variableSchema ?? version.template.variableSchema);
  const variables = input.variables ?? {};
  const bodySnapshot = substituteTemplateVariables(version.bodyTemplate, variables, whitelist);
  const subjectTemplate = version.subjectTemplate ?? version.template.subjectTemplate;
  const subject = subjectTemplate
    ? substituteTemplateVariables(subjectTemplate, variables, whitelist)
    : (input.subject ?? null);
  return { subject, bodySnapshot };
}

export async function sendCommunicationMessage(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    recipientType: string;
    recipientId: string;
    channel: (typeof communicationMessages.$inferSelect)["channel"];
    category: (typeof communicationMessages.$inferSelect)["category"];
    templateVersionId?: string;
    subject?: string;
    bodySnapshot?: string;
    variables?: Record<string, string>;
    idempotencyKey?: string;
    scheduledAt?: string;
  },
  meta: RequestMeta,
  deps: CommunicationModuleDeps,
) {
  authorize(account, organizationId, (access) => policyCommunication(access, "communication.send"));

  if (input.idempotencyKey) {
    const existing = await db.query.communicationMessages.findFirst({
      where: and(
        eq(communicationMessages.organizationId, organizationId),
        eq(communicationMessages.idempotencyKey, input.idempotencyKey),
      ),
    });
    if (existing) return { message: serializeMessage(existing), deduplicated: true as const };
  }

  await assertSendAllowed(db, {
    organizationId,
    recipientType: input.recipientType,
    recipientId: input.recipientId,
    channel: input.channel,
    category: input.category,
  });

  const rendered = await resolveMessageBody(db, organizationId, input);

  const preference =
    input.recipientType === "user"
      ? await findPreference(db, organizationId, input.recipientId, input.channel, input.category)
      : null;

  const nextAttemptAt = computeInitialNextAttemptAt(preference, input.category, input.scheduledAt);
  const idempotencyKey =
    input.idempotencyKey ??
    `msg-${organizationId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const [message] = await db
    .insert(communicationMessages)
    .values({
      organizationId,
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      channel: input.channel,
      category: input.category,
      templateVersionId: input.templateVersionId ?? null,
      subject: rendered.subject,
      bodySnapshot: rendered.bodySnapshot,
      status: "queued",
      idempotencyKey,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    })
    .returning();

  await appendHistory(db, {
    organizationId,
    messageId: message!.id,
    fromStatus: null,
    toStatus: "queued",
  });

  const [outbox] = await db
    .insert(communicationOutbox)
    .values({
      organizationId,
      communicationMessageId: message!.id,
      idempotencyKey: `outbox-${idempotencyKey}`,
      status: "pending",
      nextAttemptAt,
      payload: { channel: input.channel, category: input.category },
    })
    .returning();

  await auditCommunication(db, account, organizationId, "communication.queued", message!.id, meta, {
    channel: input.channel,
    category: input.category,
  });

  if (input.channel === "in_app") {
    if (nextAttemptAt.getTime() <= Date.now()) {
      await processCommunicationOutboxEntry(db, deps, outbox!.id, {
        actorUserId: account.user.id,
        requestId: meta.requestId,
      });
    }
  } else if (nextAttemptAt.getTime() <= Date.now()) {
    await processCommunicationOutboxEntry(db, deps, outbox!.id, {
      actorUserId: account.user.id,
      requestId: meta.requestId,
    });
  }

  const refreshed = await db.query.communicationMessages.findFirst({
    where: eq(communicationMessages.id, message!.id),
  });
  return { message: serializeMessage(refreshed!), outboxId: outbox!.id };
}

export async function listCommunicationMessages(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  query: {
    channel?: string;
    category?: string;
    status?: string;
    recipientType?: string;
    recipientId?: string;
    limit: number;
    offset: number;
  },
) {
  authorize(account, organizationId, (access) => policyCommunication(access, "communication.read"));
  const rows = await db.query.communicationMessages.findMany({
    where: and(
      eq(communicationMessages.organizationId, organizationId),
      query.channel ? eq(communicationMessages.channel, query.channel as never) : undefined,
      query.category ? eq(communicationMessages.category, query.category as never) : undefined,
      query.status ? eq(communicationMessages.status, query.status as never) : undefined,
      query.recipientType
        ? eq(communicationMessages.recipientType, query.recipientType)
        : undefined,
      query.recipientId ? eq(communicationMessages.recipientId, query.recipientId) : undefined,
    ),
    limit: query.limit,
    offset: query.offset,
    orderBy: [desc(communicationMessages.createdAt)],
  });
  return { items: rows.map(serializeMessage) };
}

export async function getCommunicationMessageHistory(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  messageId: string,
) {
  authorize(account, organizationId, (access) => policyCommunication(access, "communication.read"));
  const message = await db.query.communicationMessages.findFirst({
    where: and(
      eq(communicationMessages.id, messageId),
      eq(communicationMessages.organizationId, organizationId),
    ),
  });
  if (!message) throw new AppError("NOT_FOUND", "Mensagem não encontrada.");
  const history = await db.query.communicationMessageHistory.findMany({
    where: eq(communicationMessageHistory.messageId, messageId),
    orderBy: [asc(communicationMessageHistory.createdAt)],
  });
  return { items: history };
}

export async function retryCommunicationMessage(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  messageId: string,
  meta: RequestMeta,
  deps: CommunicationModuleDeps,
) {
  authorize(account, organizationId, (access) => policyCommunication(access, "communication.send"));
  const message = await db.query.communicationMessages.findFirst({
    where: and(
      eq(communicationMessages.id, messageId),
      eq(communicationMessages.organizationId, organizationId),
    ),
  });
  if (!message) throw new AppError("NOT_FOUND", "Mensagem não encontrada.");
  if (!isTransientCommunicationError(message.errorCode)) {
    throw new AppError("CONFLICT", "Retry permitido apenas para falhas transitórias.");
  }

  const outbox = await db.query.communicationOutbox.findFirst({
    where: eq(communicationOutbox.communicationMessageId, messageId),
  });
  if (!outbox) throw new AppError("NOT_FOUND", "Outbox não encontrado.");

  await db
    .update(communicationOutbox)
    .set({ status: "pending", nextAttemptAt: new Date(), lastErrorCode: null })
    .where(eq(communicationOutbox.id, outbox.id));
  await db
    .update(communicationMessages)
    .set({ status: "queued", failedAt: null, errorCode: null })
    .where(eq(communicationMessages.id, messageId));

  await processCommunicationOutboxEntry(db, deps, outbox.id, {
    actorUserId: account.user.id,
    requestId: meta.requestId,
  });

  const refreshed = await db.query.communicationMessages.findFirst({
    where: eq(communicationMessages.id, messageId),
  });
  return { message: serializeMessage(refreshed!) };
}
