import { describe, expect, it } from "vitest";
import { NotConfiguredKeyManagementProvider } from "@verasjuris/ai";
import { createAppKeyFieldEncryption, createSecretReferenceCodec } from "./field-encryption.js";

describe("field-encryption", () => {
  it("criptografa e descriptografa com APP_ENCRYPTION_KEY", async () => {
    const codec = createAppKeyFieldEncryption("test-app-encryption-key-please-change");
    const payload = await codec.encrypt("totp-secret-value");
    expect(payload.status).toBe("ok");
    expect(payload.ciphertext).toBeTruthy();
    const plain = await codec.decryptToString({
      keyId: payload.keyId!,
      iv: payload.iv!,
      ciphertext: payload.ciphertext!,
    });
    expect(plain).toBe("totp-secret-value");
  });

  it("secret reference roundtrip com fallback de APP key quando KMS ausente", async () => {
    const refs = createSecretReferenceCodec({
      kms: new NotConfiguredKeyManagementProvider(),
      appEncryptionKey: "another-local-key-for-tests-32b",
    });
    const reference = await refs.encryptToReference("mfa-secret");
    expect(reference.startsWith("appenc:v1:")).toBe(true);
    expect(await refs.decryptFromReference(reference)).toBe("mfa-secret");
  });
});
