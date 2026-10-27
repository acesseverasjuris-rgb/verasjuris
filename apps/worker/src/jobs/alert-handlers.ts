import {
  auctionAlertRules,
  auctions,
  deadlineAlertDispatches,
  deadlineAlertRules,
  deadlines,
  notifications,
  organizationMembers,
  type AppDatabase,
} from "@verasjuris/database";
import type { JobHandler, JobRecord } from "@verasjuris/events";
import { InAppNotificationProvider } from "@verasjuris/notifications";
import { and, eq, gte, lte } from "drizzle-orm";

export const JOB_DEADLINE_ALERT_DISPATCH = "DEADLINE_ALERT_DISPATCH" as const;
export const JOB_AUCTION_ALERT_CHECK = "AUCTION_ALERT_CHECK" as const;

type DeadlineAlertPayload = {
  organizationId: string;
  deadlineId?: string;
};

type AuctionAlertPayload = {
  organizationId: string;
};

/**
 * Handlers locais (LocalInProcessQueueProvider) para alertas in-app.
 * Canais externos permanecem NOT_CONFIGURED.
 */
export function createDeadlineAlertDispatchHandler(db: AppDatabase): JobHandler {
  const notificationsProvider = new InAppNotificationProvider();
  return async (job: JobRecord) => {
    const payload = job.payload as DeadlineAlertPayload;
    if (!payload?.organizationId) {
      throw Object.assign(new Error("DEADLINE_ALERT_DISPATCH exige organizationId"), {
        code: "VALIDATION_ERROR",
      });
    }
    const rules = await db.query.deadlineAlertRules.findMany({
      where: and(
        eq(deadlineAlertRules.organizationId, payload.organizationId),
        eq(deadlineAlertRules.active, true),
      ),
    });
    if (rules.length === 0) return;

    const now = new Date();
    const windowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const candidates = await db.query.deadlines.findMany({
      where: and(
        eq(deadlines.organizationId, payload.organizationId),
        eq(deadlines.status, "confirmed"),
        ...(payload.deadlineId ? [eq(deadlines.id, payload.deadlineId)] : []),
        gte(deadlines.confirmedDueAt, now),
        lte(deadlines.confirmedDueAt, windowEnd),
      ),
      limit: 100,
    });

    for (const deadline of candidates) {
      if (!deadline.responsibleMembershipId || !deadline.confirmedDueAt) continue;
      const member = await db.query.organizationMembers.findFirst({
        where: eq(organizationMembers.id, deadline.responsibleMembershipId),
      });
      if (!member) continue;
      for (const rule of rules) {
        const existing = await db.query.deadlineAlertDispatches.findFirst({
          where: and(
            eq(deadlineAlertDispatches.deadlineId, deadline.id),
            eq(deadlineAlertDispatches.alertRuleId, rule.id),
            eq(deadlineAlertDispatches.channel, "in_app"),
          ),
        });
        if (existing) continue;

        const send = await notificationsProvider.send({
          organizationId: payload.organizationId,
          userId: member.userId,
          channel: "in_app",
          type: "deadline.alert",
          title: `Alerta de prazo: ${deadline.title}`,
          message: `Regra “${rule.name}” (job local). Canal: in-app.`,
          resourceType: "deadline",
          resourceId: deadline.id,
        });
        if (send.status === "not_configured") continue;

        const [row] = await db
          .insert(notifications)
          .values({
            organizationId: payload.organizationId,
            userId: member.userId,
            type: "deadline.alert",
            title: `Alerta de prazo: ${deadline.title}`,
            message: `Regra “${rule.name}” (job local). Canal: in-app.`,
            resourceType: "deadline",
            resourceId: deadline.id,
          })
          .returning({ id: notifications.id });

        await db.insert(deadlineAlertDispatches).values({
          organizationId: payload.organizationId,
          deadlineId: deadline.id,
          alertRuleId: rule.id,
          channel: "in_app",
          notificationId: row?.id ?? null,
        });
      }
    }
  };
}

export function createAuctionAlertCheckHandler(db: AppDatabase): JobHandler {
  const notificationsProvider = new InAppNotificationProvider();
  return async (job: JobRecord) => {
    const payload = job.payload as AuctionAlertPayload;
    if (!payload?.organizationId) {
      throw Object.assign(new Error("AUCTION_ALERT_CHECK exige organizationId"), {
        code: "VALIDATION_ERROR",
      });
    }
    const rules = await db.query.auctionAlertRules.findMany({
      where: and(
        eq(auctionAlertRules.organizationId, payload.organizationId),
        eq(auctionAlertRules.active, true),
      ),
    });
    if (rules.length === 0) return;

    const openAuctions = await db.query.auctions.findMany({
      where: and(eq(auctions.status, "open")),
      limit: 50,
    });
    if (openAuctions.length === 0) return;

    const members = await db.query.organizationMembers.findMany({
      where: and(
        eq(organizationMembers.organizationId, payload.organizationId),
        eq(organizationMembers.status, "active"),
      ),
      limit: 5,
    });
    const recipient = members[0];
    if (!recipient) return;

    for (const rule of rules) {
      const send = await notificationsProvider.send({
        organizationId: payload.organizationId,
        userId: recipient.userId,
        channel: "in_app",
        type: "auction.alert",
        title: `Alerta de leilão: ${rule.name}`,
        message: `${openAuctions.length} leilão(ões) abertos coincidem com a regra (checagem local in-app).`,
        resourceType: "auction_alert_rule",
        resourceId: rule.id,
      });
      if (send.status === "not_configured") continue;
      await db.insert(notifications).values({
        organizationId: payload.organizationId,
        userId: recipient.userId,
        type: "auction.alert",
        title: `Alerta de leilão: ${rule.name}`,
        message: `${openAuctions.length} leilão(ões) abertos coincidem com a regra (checagem local in-app).`,
        resourceType: "auction_alert_rule",
        resourceId: rule.id,
      });
    }
  };
}

export function registerLocalAlertHandlers(
  queue: {
    status: string;
    registerHandler?: (type: string, handler: JobHandler) => void;
  },
  db: AppDatabase,
): void {
  if (queue.status !== "local_in_process" || typeof queue.registerHandler !== "function") {
    return;
  }
  queue.registerHandler(JOB_DEADLINE_ALERT_DISPATCH, createDeadlineAlertDispatchHandler(db));
  queue.registerHandler(JOB_AUCTION_ALERT_CHECK, createAuctionAlertCheckHandler(db));
}
