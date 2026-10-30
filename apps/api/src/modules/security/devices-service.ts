import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { userDevices } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq, isNull } from "drizzle-orm";

export class DevicesService {
  constructor(private readonly db: AppDatabase) {}

  async list(account: SessionAccount) {
    const items = await this.db.query.userDevices.findMany({
      where: and(eq(userDevices.userId, account.user.id), isNull(userDevices.revokedAt)),
      orderBy: [desc(userDevices.lastSeenAt)],
    });
    return {
      items: items.map((row) => ({
        id: row.id,
        deviceId: row.deviceId,
        deviceName: row.deviceName,
        browser: row.browser,
        os: row.os,
        trusted: row.trusted,
        firstSeenAt: row.firstSeenAt.toISOString(),
        lastSeenAt: row.lastSeenAt.toISOString(),
      })),
    };
  }

  async upsert(
    account: SessionAccount,
    input: { deviceId: string; deviceName?: string; browser?: string; os?: string },
  ) {
    const existing = await this.db.query.userDevices.findFirst({
      where: and(eq(userDevices.userId, account.user.id), eq(userDevices.deviceId, input.deviceId)),
    });
    if (existing) {
      const [row] = await this.db
        .update(userDevices)
        .set({
          deviceName: input.deviceName ?? existing.deviceName,
          browser: input.browser ?? existing.browser,
          os: input.os ?? existing.os,
          lastSeenAt: new Date(),
          revokedAt: null,
        })
        .where(eq(userDevices.id, existing.id))
        .returning();
      return { device: row };
    }
    const [row] = await this.db
      .insert(userDevices)
      .values({
        userId: account.user.id,
        deviceId: input.deviceId,
        deviceName: input.deviceName ?? null,
        browser: input.browser ?? null,
        os: input.os ?? null,
      })
      .returning();
    return { device: row };
  }

  async trust(account: SessionAccount, deviceRowId: string, trusted: boolean) {
    const row = await this.db.query.userDevices.findFirst({
      where: and(eq(userDevices.id, deviceRowId), eq(userDevices.userId, account.user.id)),
    });
    if (!row || row.revokedAt) throw new AppError("NOT_FOUND", "Dispositivo não encontrado.");
    const [updated] = await this.db
      .update(userDevices)
      .set({ trusted })
      .where(eq(userDevices.id, deviceRowId))
      .returning();
    return { device: { id: updated!.id, trusted: updated!.trusted } };
  }

  async revoke(account: SessionAccount, deviceRowId: string) {
    const row = await this.db.query.userDevices.findFirst({
      where: and(eq(userDevices.id, deviceRowId), eq(userDevices.userId, account.user.id)),
    });
    if (!row || row.revokedAt) throw new AppError("NOT_FOUND", "Dispositivo não encontrado.");
    await this.db
      .update(userDevices)
      .set({ revokedAt: new Date(), trusted: false })
      .where(eq(userDevices.id, deviceRowId));
    return { revoked: true };
  }
}
