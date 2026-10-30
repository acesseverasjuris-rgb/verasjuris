import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { AppError } from "@verasjuris/types";
import type {
  DecryptFieldInput,
  EncryptFieldInput,
  EncryptedFieldPayload,
  KeyManagementProvider,
} from "@verasjuris/ai";

/**
 * Criptografia de campo via KeyManagementProvider.
 * Fallback documentado: quando KMS é NOT_CONFIGURED, usa AES-256-GCM com
 * `APP_ENCRYPTION_KEY` (32 bytes hex ou string derivada via SHA-256).
 * Nunca armazena plaintext como se fosse ciphertext.
 */

export type FieldEncryptionCodec = {
  encrypt(plaintext: string | Uint8Array, keyId?: string): Promise<EncryptedFieldPayload>;
  decrypt(input: DecryptFieldInput): Promise<Uint8Array>;
  decryptToString(input: DecryptFieldInput, encoding?: BufferEncoding): Promise<string>;
};

/** Codec que serializa em referência textual (`kms:…` / `appenc:…`) para colunas secret_reference. */
export type SecretReferenceCodec = {
  encryptToReference(plaintext: string): Promise<string>;
  decryptFromReference(reference: string): Promise<string>;
};

function toBytes(value: string | Uint8Array): Uint8Array {
  if (typeof value === "string") return new TextEncoder().encode(value);
  return value;
}

function deriveAppKey(appEncryptionKey: string): Buffer {
  const trimmed = appEncryptionKey.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  return createHash("sha256").update(trimmed, "utf8").digest();
}

function encryptWithAppKey(plaintext: Uint8Array, key: Buffer): EncryptedFieldPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    providerKey: "app_encryption_key",
    keyId: "appenc:v1",
    ciphertext: new Uint8Array(Buffer.concat([ciphertext, tag])),
    iv: new Uint8Array(iv),
    algorithm: "aes-256-gcm",
    status: "ok",
  };
}

function decryptWithAppKey(input: DecryptFieldInput, key: Buffer): Uint8Array {
  const raw = Buffer.from(input.ciphertext);
  if (raw.length < 17) {
    throw new AppError("VALIDATION_ERROR", "Ciphertext de campo inválido.");
  }
  const tag = raw.subarray(raw.length - 16);
  const data = raw.subarray(0, raw.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(input.iv));
  decipher.setAuthTag(tag);
  return new Uint8Array(Buffer.concat([decipher.update(data), decipher.final()]));
}

export function createAppKeyFieldEncryption(appEncryptionKey: string): FieldEncryptionCodec {
  if (!appEncryptionKey.trim()) {
    throw new AppError(
      "NOT_CONFIGURED",
      "APP_ENCRYPTION_KEY ausente. Configure a chave ou um KeyManagementProvider.",
    );
  }
  const key = deriveAppKey(appEncryptionKey);
  return {
    async encrypt(plaintext) {
      return encryptWithAppKey(toBytes(plaintext), key);
    },
    async decrypt(input) {
      return decryptWithAppKey(input, key);
    },
    async decryptToString(input, encoding: BufferEncoding = "utf8") {
      const bytes = await this.decrypt(input);
      return Buffer.from(bytes).toString(encoding);
    },
  };
}

export function createFieldEncryption(kms: KeyManagementProvider): FieldEncryptionCodec {
  return {
    async encrypt(plaintext, keyId) {
      const health = await kms.healthCheck();
      if (health.status === "not_configured" || kms.id === "not_configured") {
        throw new AppError(
          "NOT_CONFIGURED",
          "Criptografia de campo indisponível: KeyManagementProvider não configurado.",
        );
      }
      const input: EncryptFieldInput = {
        plaintext: toBytes(plaintext),
        keyId,
      };
      const result = await kms.encrypt(input);
      if (result.status === "not_configured" || !result.ciphertext || !result.iv || !result.keyId) {
        throw new AppError(
          "NOT_CONFIGURED",
          "Criptografia de campo indisponível: KeyManagementProvider não configurado.",
        );
      }
      return result;
    },

    async decrypt(input) {
      const health = await kms.healthCheck();
      if (health.status === "not_configured" || kms.id === "not_configured") {
        throw new AppError(
          "NOT_CONFIGURED",
          "Descriptografia de campo indisponível: KeyManagementProvider não configurado.",
        );
      }
      return kms.decrypt(input);
    },

    async decryptToString(input, encoding: BufferEncoding = "utf8") {
      const bytes = await this.decrypt(input);
      return Buffer.from(bytes).toString(encoding);
    },
  };
}

/**
 * Prefere KMS quando saudável; senão usa APP_ENCRYPTION_KEY.
 * Documentação: produção deve preferir KMS; APP_ENCRYPTION_KEY é fallback local.
 */
export function createFieldEncryptionWithFallback(options: {
  kms: KeyManagementProvider;
  appEncryptionKey?: string | null;
}): FieldEncryptionCodec {
  const kmsCodec = createFieldEncryption(options.kms);
  const appKey = options.appEncryptionKey?.trim() || process.env.APP_ENCRYPTION_KEY?.trim() || "";
  const appCodec = appKey ? createAppKeyFieldEncryption(appKey) : null;

  return {
    async encrypt(plaintext, keyId) {
      try {
        return await kmsCodec.encrypt(plaintext, keyId);
      } catch (error) {
        if (error instanceof AppError && error.code === "NOT_CONFIGURED" && appCodec) {
          return appCodec.encrypt(plaintext, keyId);
        }
        throw error;
      }
    },
    async decrypt(input) {
      if (input.keyId.startsWith("appenc:") && appCodec) {
        return appCodec.decrypt(input);
      }
      try {
        return await kmsCodec.decrypt(input);
      } catch (error) {
        if (error instanceof AppError && error.code === "NOT_CONFIGURED" && appCodec) {
          return appCodec.decrypt(input);
        }
        throw error;
      }
    },
    async decryptToString(input, encoding: BufferEncoding = "utf8") {
      const bytes = await this.decrypt(input);
      return Buffer.from(bytes).toString(encoding);
    },
  };
}

function encodePayload(payload: EncryptedFieldPayload): string {
  if (!payload.ciphertext || !payload.iv || !payload.keyId) {
    throw new AppError("INTERNAL_ERROR", "Payload criptografado incompleto.");
  }
  const prefix = payload.providerKey === "app_encryption_key" ? "appenc" : "kms";
  const body = Buffer.from(
    JSON.stringify({
      keyId: payload.keyId,
      iv: Buffer.from(payload.iv).toString("base64url"),
      ciphertext: Buffer.from(payload.ciphertext).toString("base64url"),
      algorithm: payload.algorithm,
      providerKey: payload.providerKey,
    }),
  ).toString("base64url");
  return `${prefix}:v1:${body}`;
}

function decodePayload(reference: string): DecryptFieldInput & { providerKey: string } {
  const match = /^(appenc|kms):v1:(.+)$/.exec(reference.trim());
  if (!match) {
    throw new AppError("VALIDATION_ERROR", "Referência de segredo inválida.");
  }
  const parsed = JSON.parse(Buffer.from(match[2]!, "base64url").toString("utf8")) as {
    keyId: string;
    iv: string;
    ciphertext: string;
    providerKey?: string;
  };
  return {
    keyId: parsed.keyId,
    iv: new Uint8Array(Buffer.from(parsed.iv, "base64url")),
    ciphertext: new Uint8Array(Buffer.from(parsed.ciphertext, "base64url")),
    providerKey: parsed.providerKey ?? match[1]!,
  };
}

export function createSecretReferenceCodec(options: {
  kms: KeyManagementProvider;
  appEncryptionKey?: string | null;
}): SecretReferenceCodec {
  const codec = createFieldEncryptionWithFallback(options);
  return {
    async encryptToReference(plaintext) {
      const payload = await codec.encrypt(plaintext);
      return encodePayload(payload);
    },
    async decryptFromReference(reference) {
      const decoded = decodePayload(reference);
      return codec.decryptToString({
        keyId: decoded.keyId,
        iv: decoded.iv,
        ciphertext: decoded.ciphertext,
      });
    },
  };
}
