import { AppError } from "@verasjuris/types";

/**
 * Key management / envelope encryption.
 * Default: not_configured — field encryption deve falhar com NOT_CONFIGURED (sem plaintext secrets).
 */

export type KeyManagementHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type EncryptFieldInput = {
  plaintext: Uint8Array;
  keyId?: string;
  aad?: Uint8Array;
  signal?: AbortSignal;
};

export type EncryptedFieldPayload = {
  providerKey: string;
  keyId: string | null;
  ciphertext: Uint8Array | null;
  iv: Uint8Array | null;
  algorithm: string | null;
  status: "ok" | "not_configured" | "failed";
  detail?: string;
};

export type DecryptFieldInput = {
  ciphertext: Uint8Array;
  keyId: string;
  iv: Uint8Array;
  aad?: Uint8Array;
  signal?: AbortSignal;
};

export interface KeyManagementProvider {
  readonly id: string;
  encrypt(input: EncryptFieldInput): Promise<EncryptedFieldPayload>;
  decrypt(input: DecryptFieldInput): Promise<Uint8Array>;
  healthCheck(): Promise<KeyManagementHealth>;
}

const MESSAGE =
  "Nenhum provedor de gerenciamento de chaves está configurado. Criptografia de campo indisponível.";

export class NotConfiguredKeyManagementProvider implements KeyManagementProvider {
  readonly id = "not_configured";

  encrypt(_input: EncryptFieldInput): Promise<EncryptedFieldPayload> {
    return Promise.reject(new AppError("NOT_CONFIGURED", MESSAGE));
  }

  decrypt(_input: DecryptFieldInput): Promise<Uint8Array> {
    return Promise.reject(new AppError("NOT_CONFIGURED", MESSAGE));
  }

  healthCheck(): Promise<KeyManagementHealth> {
    return Promise.resolve({
      status: "not_configured",
      detail: MESSAGE,
      checkedAt: new Date().toISOString(),
    });
  }
}

export function keyManagementProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
