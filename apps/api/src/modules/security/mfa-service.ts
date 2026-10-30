import { randomBytes } from "node:crypto";
import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { mfaMethods, mfaRecoveryCodes, users } from "@verasjuris/database";
import {
  buildOtpAuthUri,
  createSecretReferenceCodec,
  generateTotpSecret,
  hashOpaqueToken,
  opaqueTokensEqual,
  verifyTotp,
  type SecretReferenceCodec,
} from "@verasjuris/security";
import type { KeyManagementProvider } from "@verasjuris/ai";
import { AppError } from "@verasjuris/types";
import { and, eq, isNull } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";

const RECOVERY_COUNT = 8;

function generateRecoveryCode(): string {
  return randomBytes(5).toString("hex");
}

export class MfaService {
  private readonly secrets: SecretReferenceCodec;

  constructor(
    private readonly db: AppDatabase,
    kms: KeyManagementProvider,
    appEncryptionKey?: string | null,
  ) {
    this.secrets = createSecretReferenceCodec({ kms, appEncryptionKey });
  }

  async beginTotp(account: SessionAccount, meta: RequestMeta) {
    void meta;
    const secret = generateTotpSecret();
    const secretReference = await this.secrets.encryptToReference(secret);
    const existing = await this.db.query.mfaMethods.findFirst({
      where: and(eq(mfaMethods.userId, account.user.id), eq(mfaMethods.type, "totp")),
    });
    let methodId: string;
    if (existing) {
      await this.db
        .update(mfaMethods)
        .set({
          secretReference,
          status: "pending",
          verifiedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(mfaMethods.id, existing.id));
      methodId = existing.id;
    } else {
      const [row] = await this.db
        .insert(mfaMethods)
        .values({
          userId: account.user.id,
          type: "totp",
          secretReference,
          status: "pending",
        })
        .returning();
      methodId = row!.id;
    }
    return {
      methodId,
      secret,
      otpauthUri: buildOtpAuthUri({
        secret,
        accountName: account.user.email,
        issuer: "VerasJuris",
      }),
      note: "O segredo é exibido uma vez. Em produção use KMS; com KMS ausente usa APP_ENCRYPTION_KEY.",
    };
  }

  async enableTotp(account: SessionAccount, code: string, meta: RequestMeta) {
    void meta;
    const method = await this.db.query.mfaMethods.findFirst({
      where: and(
        eq(mfaMethods.userId, account.user.id),
        eq(mfaMethods.type, "totp"),
        eq(mfaMethods.status, "pending"),
      ),
    });
    if (!method?.secretReference) {
      throw new AppError("VALIDATION_ERROR", "Inicie o MFA TOTP antes de confirmar o código.");
    }
    const secret = await this.secrets.decryptFromReference(method.secretReference);
    if (!verifyTotp(secret, code)) {
      throw new AppError("AUTHENTICATION_ERROR", "Código TOTP inválido. MFA não foi ativado.");
    }
    const recoveryPlain = Array.from({ length: RECOVERY_COUNT }, () => generateRecoveryCode());
    await this.db.transaction(async (tx) => {
      await tx
        .update(mfaMethods)
        .set({
          status: "active",
          verifiedAt: new Date(),
          lastUsedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(mfaMethods.id, method.id));
      await tx.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, account.user.id));
      for (const codePlain of recoveryPlain) {
        await tx.insert(mfaRecoveryCodes).values({
          userId: account.user.id,
          codeHash: hashOpaqueToken(codePlain),
        });
      }
      await tx
        .update(users)
        .set({ mfaStatus: "enabled", mfaEnabled: true, updatedAt: new Date() })
        .where(eq(users.id, account.user.id));
    });
    return {
      enabled: true,
      recoveryCodes: recoveryPlain,
      warning: "Guarde os códigos de recuperação. Eles não são armazenados em plaintext.",
    };
  }

  async verifyTotp(account: SessionAccount, code: string) {
    const method = await this.requireActiveTotp(account.user.id);
    const secret = await this.secrets.decryptFromReference(method.secretReference!);
    if (!verifyTotp(secret, code)) {
      throw new AppError("AUTHENTICATION_ERROR", "Código TOTP inválido.");
    }
    await this.db
      .update(mfaMethods)
      .set({ lastUsedAt: new Date(), updatedAt: new Date() })
      .where(eq(mfaMethods.id, method.id));
    return { verified: true };
  }

  async verifyRecoveryCode(account: SessionAccount, code: string) {
    const rows = await this.db.query.mfaRecoveryCodes.findMany({
      where: and(eq(mfaRecoveryCodes.userId, account.user.id), isNull(mfaRecoveryCodes.usedAt)),
    });
    const match = rows.find((row) => opaqueTokensEqual(code.trim(), row.codeHash));
    if (!match) {
      throw new AppError("AUTHENTICATION_ERROR", "Código de recuperação inválido ou já utilizado.");
    }
    await this.db
      .update(mfaRecoveryCodes)
      .set({ usedAt: new Date() })
      .where(eq(mfaRecoveryCodes.id, match.id));
    return { verified: true, remaining: rows.length - 1 };
  }

  async disableTotp(account: SessionAccount) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(mfaMethods)
        .set({ status: "disabled", updatedAt: new Date() })
        .where(and(eq(mfaMethods.userId, account.user.id), eq(mfaMethods.type, "totp")));
      await tx.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, account.user.id));
      await tx
        .update(users)
        .set({ mfaStatus: "disabled", mfaEnabled: false, updatedAt: new Date() })
        .where(eq(users.id, account.user.id));
    });
    return { disabled: true };
  }

  async status(account: SessionAccount) {
    const user = await this.db.query.users.findFirst({ where: eq(users.id, account.user.id) });
    const method = await this.db.query.mfaMethods.findFirst({
      where: and(eq(mfaMethods.userId, account.user.id), eq(mfaMethods.type, "totp")),
    });
    const unused = await this.db.query.mfaRecoveryCodes.findMany({
      where: and(eq(mfaRecoveryCodes.userId, account.user.id), isNull(mfaRecoveryCodes.usedAt)),
    });
    return {
      mfaStatus: user?.mfaStatus ?? "disabled",
      totp: method
        ? {
            id: method.id,
            status: method.status,
            verifiedAt: method.verifiedAt?.toISOString() ?? null,
          }
        : null,
      recoveryCodesRemaining: unused.length,
    };
  }

  private async requireActiveTotp(userId: string) {
    const method = await this.db.query.mfaMethods.findFirst({
      where: and(
        eq(mfaMethods.userId, userId),
        eq(mfaMethods.type, "totp"),
        eq(mfaMethods.status, "active"),
      ),
    });
    if (!method?.secretReference) {
      throw new AppError("VALIDATION_ERROR", "MFA TOTP não está ativo nesta conta.");
    }
    return method;
  }
}
