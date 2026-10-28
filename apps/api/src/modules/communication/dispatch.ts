import {
  type ChannelSendResult,
  type CommunicationChannelAdapter,
  type CommunicationChannelKey,
  createDefaultCommunicationChannels,
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
  communicationMessageHistory,
  communicationMessages,
  communicationOutbox,
  notifications,
  users,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, asc, eq, inArray, lte, or, sql } from "drizzle-orm";

export type CommunicationDispatchDeps = {
  channels: Record<CommunicationChannelKey, CommunicationChannelAdapter>;
};

export const TRANSIENT_COMMUNICATION_ERROR_CODES = new Set([
  "RATE_LIMIT",
  "TIMEOUT",
  "NETWORK_ERROR",
  "PROVIDER_UNAVAILABLE",
  "TEMPORARY_FAILURE",
]);

export function isTransientCommunicationError(code: string | null | undefined): boolean {
  if (!code) return false;
  return TRANSIENT_COMMUNICATION_ERROR_CODES.has(code.toUpperCase());
}

export function createCommunicationDispatchDeps(input?: {
  emailProvider?: EmailProvider;
  smsProvider?: SmsProvider;
  whatsappProvider?: WhatsAppProvider;
  pushProvider?: PushProvider;
}): CommunicationDispatchDeps {
  if (!input) {
    return { channels: createDefaultCommunicationChannels() };
  }
  return {
    channels: {
      email: new EmailCommunicationChannel(input.emailProvider ?? new NotConfiguredEmailProvider()),
      sms: new SmsCommunicationChannel(input.smsProvider ?? new NotConfiguredSmsProvider()),
      whatsapp: new WhatsAppCommunicationChannel(
        input.whatsappProvider ?? new NotConfiguredWhatsAppProvider(),
      ),
      push: new PushCommunicationChannel(input.pushProvider ?? new NotConfiguredPushProvider()),
    },
  };
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

async function resolveUserEmail(db: AppDatabase, userId: string): Promise<string | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { email: true },
  });
  return row?.email ?? null;
}

function mapChannelResultToMessageStatus(
  channelStatus: string,
): (typeof communicationMessages.$inferSelect)["status"] {
  if (channelStatus === "not_configured") return "not_configured";
  if (channelStatus === "delivered") return "delivered";
  if (channelStatus === "sent" || channelStatus === "queued") return "sent";
  return "failed";
}

function mapChannelResultToOutboxStatus(
  channelStatus: string,
): (typeof communicationOutbox.$inferSelect)["status"] {
  if (channelStatus === "not_configured") return "not_configured";
  if (channelStatus === "failed") return "failed";
  return "completed";
}

/**
 * Entrega in-app: persistência real em `notifications`. Só marcamos delivered após insert.
 */
async function deliverInApp(
  db: AppDatabase,
  message: typeof communicationMessages.$inferSelect,
): Promise<void> {
  if (message.recipientType !== "user") {
    throw new AppError("VALIDATION_ERROR", "Canal in_app exige recipientType user.");
  }
  const title = message.subject?.trim() || "Notificação";
  const [row] = await db
    .insert(notifications)
    .values({
      organizationId: message.organizationId,
      userId: message.recipientId,
      type: `communication.${message.category}`,
      title,
      message: message.bodySnapshot,
      resourceType: "communication_message",
      resourceId: message.id,
    })
    .returning({ id: notifications.id });

  const now = new Date();
  await db
    .update(communicationMessages)
    .set({
      status: "delivered",
      providerKey: "in_app",
      deliveredAt: now,
      sentAt: now,
    })
    .where(eq(communicationMessages.id, message.id));

  await appendHistory(db, {
    organizationId: message.organizationId,
    messageId: message.id,
    fromStatus: message.status,
    toStatus: "delivered",
    detail: row ? `notification:${row.id}` : undefined,
  });
}

async function deliverExternalChannel(
  db: AppDatabase,
  deps: CommunicationDispatchDeps,
  message: typeof communicationMessages.$inferSelect,
  outbox: typeof communicationOutbox.$inferSelect,
): Promise<void> {
  const channelKey = message.channel;
  if (channelKey === "in_app") return;

  const adapter = deps.channels[channelKey as CommunicationChannelKey];
  const idempotencyKey = outbox.idempotencyKey;

  await db
    .update(communicationMessages)
    .set({ status: "sending", attemptCount: sql`${communicationMessages.attemptCount} + 1` })
    .where(eq(communicationMessages.id, message.id));

  await db
    .update(communicationOutbox)
    .set({ status: "processing", attemptCount: sql`${communicationOutbox.attemptCount} + 1` })
    .where(eq(communicationOutbox.id, outbox.id));

  let result: ChannelSendResult;
  try {
    if (channelKey === "email") {
      const to =
        message.recipientType === "user" ? await resolveUserEmail(db, message.recipientId) : null;
      result = await adapter.send({
        channel: "email",
        email: {
          to: to ?? "unknown@invalid.local",
          subject: message.subject ?? undefined,
          bodyText: message.bodySnapshot,
          idempotencyKey,
        },
      });
    } else if (channelKey === "sms") {
      result = await adapter.send({
        channel: "sms",
        sms: {
          to: message.recipientId,
          body: message.bodySnapshot,
          idempotencyKey,
        },
      });
    } else if (channelKey === "whatsapp") {
      result = await adapter.send({
        channel: "whatsapp",
        whatsapp: {
          to: message.recipientId,
          body: message.bodySnapshot,
          idempotencyKey,
        },
      });
    } else {
      result = await adapter.send({
        channel: "push",
        push: {
          deviceToken: message.recipientId,
          title: message.subject ?? "VerasJuris",
          body: message.bodySnapshot,
          idempotencyKey,
        },
      });
    }
  } catch (error) {
    const code =
      error instanceof Error && "code" in error && typeof error.code === "string"
        ? error.code
        : "PROVIDER_UNAVAILABLE";
    const now = new Date();
    const transient = isTransientCommunicationError(code);
    await db
      .update(communicationMessages)
      .set({
        status: "failed",
        failedAt: now,
        errorCode: code,
      })
      .where(eq(communicationMessages.id, message.id));
    await db
      .update(communicationOutbox)
      .set({
        status: transient ? "failed" : "failed",
        lastErrorCode: code,
        nextAttemptAt: transient
          ? new Date(now.getTime() + Math.min(300_000, 30_000 * (outbox.attemptCount + 1)))
          : null,
      })
      .where(eq(communicationOutbox.id, outbox.id));
    await appendHistory(db, {
      organizationId: message.organizationId,
      messageId: message.id,
      fromStatus: "sending",
      toStatus: "failed",
      detail: code,
    });
    return;
  }

  const nextMessageStatus = mapChannelResultToMessageStatus(result.status);
  const nextOutboxStatus = mapChannelResultToOutboxStatus(result.status);
  const now = new Date();

  const messagePatch: Partial<typeof communicationMessages.$inferInsert> = {
    status: nextMessageStatus,
    providerKey: result.providerKey,
    externalMessageId: result.externalMessageId,
  };
  if (nextMessageStatus === "sent") messagePatch.sentAt = now;
  if (nextMessageStatus === "delivered") {
    messagePatch.sentAt = now;
    messagePatch.deliveredAt = now;
  }
  if (nextMessageStatus === "failed") {
    messagePatch.failedAt = now;
    messagePatch.errorCode = "DELIVERY_FAILED";
  }
  if (nextMessageStatus === "not_configured") {
    messagePatch.errorCode = "NOT_CONFIGURED";
  }

  await db
    .update(communicationMessages)
    .set(messagePatch)
    .where(eq(communicationMessages.id, message.id));

  await db
    .update(communicationOutbox)
    .set({
      status: nextOutboxStatus,
      lastErrorCode: nextMessageStatus === "not_configured" ? "NOT_CONFIGURED" : null,
      nextAttemptAt: null,
    })
    .where(eq(communicationOutbox.id, outbox.id));

  await appendHistory(db, {
    organizationId: message.organizationId,
    messageId: message.id,
    fromStatus: "sending",
    toStatus: nextMessageStatus,
    detail: result.externalMessageId ?? result.status,
  });
}

export async function processCommunicationOutboxEntry(
  db: AppDatabase,
  deps: CommunicationDispatchDeps,
  outboxId: string,
  audit?: { actorUserId?: string | null; requestId?: string },
): Promise<void> {
  const outbox = await db.query.communicationOutbox.findFirst({
    where: eq(communicationOutbox.id, outboxId),
  });
  if (!outbox) throw new AppError("NOT_FOUND", "Registro de outbox não encontrado.");
  if (outbox.status === "completed" || outbox.status === "cancelled") return;
  if (outbox.nextAttemptAt && outbox.nextAttemptAt.getTime() > Date.now()) return;

  const message = await db.query.communicationMessages.findFirst({
    where: and(
      eq(communicationMessages.id, outbox.communicationMessageId),
      eq(communicationMessages.organizationId, outbox.organizationId),
    ),
  });
  if (!message) throw new AppError("NOT_FOUND", "Mensagem de comunicação não encontrada.");

  if (message.channel === "in_app") {
    await deliverInApp(db, message);
    await db
      .update(communicationOutbox)
      .set({ status: "completed", nextAttemptAt: null })
      .where(eq(communicationOutbox.id, outbox.id));
    await recordAudit(db, {
      actorUserId: audit?.actorUserId ?? null,
      organizationId: message.organizationId,
      action: "communication.sent",
      resourceType: "communication_message",
      resourceId: message.id,
      source: "worker",
      requestId: audit?.requestId ?? null,
      after: { channel: "in_app", status: "delivered" },
    });
    return;
  }

  await deliverExternalChannel(db, deps, message, outbox);

  const refreshed = await db.query.communicationMessages.findFirst({
    where: eq(communicationMessages.id, message.id),
  });
  const action =
    refreshed?.status === "failed"
      ? "communication.failed"
      : refreshed?.status === "not_configured"
        ? "communication.failed"
        : "communication.sent";
  await recordAudit(db, {
    actorUserId: audit?.actorUserId ?? null,
    organizationId: message.organizationId,
    action,
    resourceType: "communication_message",
    resourceId: message.id,
    source: "worker",
    requestId: audit?.requestId ?? null,
    after: { channel: message.channel, status: refreshed?.status ?? null },
  });
}

export async function processDueCommunicationOutbox(
  db: AppDatabase,
  deps: CommunicationDispatchDeps,
  organizationId: string,
  limit = 20,
): Promise<number> {
  const now = new Date();
  const rows = await db
    .select()
    .from(communicationOutbox)
    .where(
      and(
        eq(communicationOutbox.organizationId, organizationId),
        inArray(communicationOutbox.status, ["pending", "failed"]),
        or(
          sql`${communicationOutbox.nextAttemptAt} IS NULL`,
          lte(communicationOutbox.nextAttemptAt, now),
        ),
      ),
    )
    .orderBy(asc(communicationOutbox.nextAttemptAt), asc(communicationOutbox.createdAt))
    .limit(limit);

  let processed = 0;
  for (const row of rows) {
    if (row.status === "not_configured" && row.attemptCount > 0) continue;
    await processCommunicationOutboxEntry(db, deps, row.id);
    processed += 1;
  }
  return processed;
}
