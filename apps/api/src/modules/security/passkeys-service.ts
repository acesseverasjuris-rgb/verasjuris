import { randomBytes } from "node:crypto";
import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { passkeyCredentials } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";

/**
 * Passkeys / WebAuthn readiness:
 * - Persistimos credentialId + publicKey + counter (sem private key).
 * - Desafios determinísticos em memória para testes.
 * - Attestation/assertion reais: NOT_CONFIGURED sem @simplewebauthn/server.
 *   Fluxo de registro aceita publicKey do cliente em modo de teste/pré-WebAuthn.
 */

type Challenge = {
  challenge: string;
  userId: string;
  expiresAt: number;
  kind: "registration" | "authentication";
};

const challenges = new Map<string, Challenge>();

export class PasskeysService {
  constructor(private readonly db: AppDatabase) {}

  async list(account: SessionAccount) {
    const items = await this.db.query.passkeyCredentials.findMany({
      where: eq(passkeyCredentials.userId, account.user.id),
      orderBy: [desc(passkeyCredentials.createdAt)],
    });
    return {
      items: items.map((row) => ({
        id: row.id,
        credentialId: row.credentialId,
        counter: row.counter,
        transports: row.transports,
        createdAt: row.createdAt.toISOString(),
        lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      })),
      webauthn: {
        status: "challenge_ready",
        attestation: "not_configured",
        note: "Attestation/assertion criptográfica completa requer @simplewebauthn/server.",
      },
    };
  }

  beginRegistration(account: SessionAccount) {
    const challenge = randomBytes(32).toString("base64url");
    challenges.set(challenge, {
      challenge,
      userId: account.user.id,
      expiresAt: Date.now() + 5 * 60 * 1000,
      kind: "registration",
    });
    return {
      challenge,
      rp: { id: "localhost", name: "VerasJuris" },
      user: {
        id: account.user.id,
        name: account.user.email,
        displayName: account.user.displayName,
      },
      attestation: "none",
      verificationMode: "client_supplied_public_key",
    };
  }

  async completeRegistration(
    account: SessionAccount,
    input: {
      challenge: string;
      credentialId: string;
      publicKey: string;
      counter?: number;
      transports?: string[];
    },
  ) {
    const stored = challenges.get(input.challenge);
    if (!stored || stored.userId !== account.user.id || stored.kind !== "registration") {
      throw new AppError("AUTHENTICATION_ERROR", "Desafio de passkey inválido ou expirado.");
    }
    if (stored.expiresAt < Date.now()) {
      challenges.delete(input.challenge);
      throw new AppError("AUTHENTICATION_ERROR", "Desafio de passkey expirado.");
    }
    challenges.delete(input.challenge);
    const [row] = await this.db
      .insert(passkeyCredentials)
      .values({
        userId: account.user.id,
        credentialId: input.credentialId,
        publicKey: input.publicKey,
        counter: input.counter ?? 0,
        transports: input.transports ?? null,
      })
      .returning();
    return {
      passkey: {
        id: row!.id,
        credentialId: row!.credentialId,
        counter: row!.counter,
      },
      attestationVerified: false,
      note: "Credencial persistida; attestation WebAuthn completa NOT_CONFIGURED.",
    };
  }

  beginAuthentication(account: SessionAccount) {
    const challenge = randomBytes(32).toString("base64url");
    challenges.set(challenge, {
      challenge,
      userId: account.user.id,
      expiresAt: Date.now() + 5 * 60 * 1000,
      kind: "authentication",
    });
    return { challenge, verificationMode: "not_configured_attestation" };
  }

  async completeAuthentication(
    account: SessionAccount,
    input: { challenge: string; credentialId: string; counter?: number },
  ) {
    const stored = challenges.get(input.challenge);
    if (!stored || stored.userId !== account.user.id || stored.kind !== "authentication") {
      throw new AppError("AUTHENTICATION_ERROR", "Desafio de autenticação passkey inválido.");
    }
    challenges.delete(input.challenge);
    const cred = await this.db.query.passkeyCredentials.findFirst({
      where: and(
        eq(passkeyCredentials.userId, account.user.id),
        eq(passkeyCredentials.credentialId, input.credentialId),
      ),
    });
    if (!cred) throw new AppError("NOT_FOUND", "Passkey não encontrada.");
    // Sem verificador WebAuthn: aceita apenas presença + counter monotônico em modo teste.
    const nextCounter = input.counter ?? cred.counter;
    if (nextCounter < cred.counter) {
      throw new AppError("AUTHENTICATION_ERROR", "Counter de passkey inválido (possível replay).");
    }
    await this.db
      .update(passkeyCredentials)
      .set({ counter: nextCounter, lastUsedAt: new Date() })
      .where(eq(passkeyCredentials.id, cred.id));
    return {
      verified: true,
      assertionVerified: false,
      note: "Assertion criptográfica WebAuthn NOT_CONFIGURED; fluxo de desafio/persistência ativo.",
    };
  }

  async revoke(account: SessionAccount, passkeyId: string) {
    const cred = await this.db.query.passkeyCredentials.findFirst({
      where: and(
        eq(passkeyCredentials.id, passkeyId),
        eq(passkeyCredentials.userId, account.user.id),
      ),
    });
    if (!cred) throw new AppError("NOT_FOUND", "Passkey não encontrada.");
    await this.db.delete(passkeyCredentials).where(eq(passkeyCredentials.id, passkeyId));
    return { revoked: true };
  }
}
