import {
  revokeAllUserSessions,
  revokeOtherSessions,
  revokeSession,
  type SessionAccount,
} from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { sessions } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";

export class SessionsSecurityService {
  constructor(private readonly db: AppDatabase) {}

  async list(account: SessionAccount) {
    const now = new Date();
    const rows = await this.db.query.sessions.findMany({
      where: and(
        eq(sessions.userId, account.user.id),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
      ),
      orderBy: [desc(sessions.createdAt)],
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        current: row.id === account.sessionId,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        lastUsedAt: (row.lastUsedAt ?? row.createdAt).toISOString(),
        deviceId: row.deviceId,
        ipMasked: row.ipMasked ?? (row.ip ? `${row.ip.split(".").slice(0, 2).join(".")}.*` : null),
        userAgentHint: row.userAgent ? row.userAgent.slice(0, 48) : null,
      })),
    };
  }

  async revokeOne(account: SessionAccount, sessionId: string, meta: RequestMeta, reason?: string) {
    const row = await this.db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), eq(sessions.userId, account.user.id)),
    });
    if (!row || row.revokedAt) throw new AppError("NOT_FOUND", "Sessão não encontrada.");
    await this.db.transaction(async (tx) => {
      await revokeSession(tx, sessionId);
      if (reason) {
        await tx.update(sessions).set({ revokeReason: reason }).where(eq(sessions.id, sessionId));
      }
    });
    void meta;
    return { revoked: true, current: sessionId === account.sessionId };
  }

  async revokeOthers(account: SessionAccount, meta: RequestMeta) {
    void meta;
    await this.db.transaction(async (tx) => {
      await revokeOtherSessions(tx, account.user.id, account.sessionId);
    });
    return { revoked: true, scope: "others" as const };
  }

  async revokeAll(account: SessionAccount, meta: RequestMeta) {
    void meta;
    await this.db.transaction(async (tx) => {
      await revokeAllUserSessions(tx, account.user.id);
    });
    return { revoked: true, scope: "all" as const };
  }
}
