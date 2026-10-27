import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;

function scryptAsync(
  password: string | Buffer,
  salt: Buffer,
  options: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, options, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const options = { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P };
  const derived = await scryptAsync(password, salt, options);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expected = parts[5];
  if (!n || !r || !p || !salt || !expected) return false;
  const derived = await scryptAsync(password, Buffer.from(salt, "base64url"), { N: n, r, p });
  const expectedBuffer = Buffer.from(expected, "base64url");
  if (expectedBuffer.length !== derived.length) return false;
  return timingSafeEqual(expectedBuffer, derived);
}

let dummyHashPromise: Promise<string> | undefined;

export async function verifyPasswordOrDummy(
  password: string,
  encoded: string | null,
): Promise<boolean> {
  if (!encoded) {
    dummyHashPromise ??= hashPassword(randomBytes(24).toString("base64url"));
    await verifyPassword(password, await dummyHashPromise);
    return false;
  }
  return verifyPassword(password, encoded);
}
