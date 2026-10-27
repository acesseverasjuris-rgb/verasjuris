import { createHash, type Hash } from "node:crypto";

export type Sha256Hasher = {
  update(chunk: Buffer | Uint8Array | string): Sha256Hasher;
  digestHex(): string;
};

/** Hasher SHA-256 streaming; `digestHex()` finaliza e retorna hex minúsculo. */
export function createSha256Hasher(): Sha256Hasher {
  const hash: Hash = createHash("sha256");
  const api: Sha256Hasher = {
    update(chunk) {
      hash.update(chunk);
      return api;
    },
    digestHex() {
      return hash.digest("hex");
    },
  };
  return api;
}
