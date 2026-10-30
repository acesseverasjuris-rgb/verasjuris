import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * TOTP (RFC 6238) com HMAC-SHA1 — sem dependências extras.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(bytes = 20): string {
  const buf = randomBytes(bytes);
  return base32Encode(buf);
}

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const cleaned = input
    .replace(/=+$/g, "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(key: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter & 0xffffffff, 4);
  const digest = createHmac("sha1", key).update(buf).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const code =
    ((digest[offset]! & 0x7f) << 24) |
    ((digest[offset + 1]! & 0xff) << 16) |
    ((digest[offset + 2]! & 0xff) << 8) |
    (digest[offset + 3]! & 0xff);
  const str = String(code % 10 ** digits);
  return str.padStart(digits, "0");
}

export type TotpOptions = {
  stepSeconds?: number;
  digits?: number;
  /** Epoch ms */
  nowMs?: number;
};

export function generateTotp(secret: string, options: TotpOptions = {}): string {
  const step = options.stepSeconds ?? 30;
  const digits = options.digits ?? 6;
  const nowMs = options.nowMs ?? Date.now();
  const counter = Math.floor(nowMs / 1000 / step);
  return hotp(base32Decode(secret), counter, digits);
}

export type VerifyTotpOptions = TotpOptions & {
  /** Janela de steps ±window (default 1). */
  window?: number;
};

export function verifyTotp(
  secret: string,
  token: string,
  options: VerifyTotpOptions = {},
): boolean {
  const trimmed = token.trim();
  const digits = options.digits ?? 6;
  if (!/^\d+$/.test(trimmed) || trimmed.length !== digits) return false;
  const step = options.stepSeconds ?? 30;
  const window = options.window ?? 1;
  const nowMs = options.nowMs ?? Date.now();
  const counter = Math.floor(nowMs / 1000 / step);
  const key = base32Decode(secret);
  const expected = Buffer.from(trimmed);
  for (let drift = -window; drift <= window; drift += 1) {
    const candidate = Buffer.from(hotp(key, counter + drift, digits));
    if (candidate.length === expected.length && timingSafeEqual(candidate, expected)) {
      return true;
    }
  }
  return false;
}

export function buildOtpAuthUri(input: {
  secret: string;
  accountName: string;
  issuer: string;
  digits?: number;
  stepSeconds?: number;
}): string {
  const label = encodeURIComponent(`${input.issuer}:${input.accountName}`);
  const params = new URLSearchParams({
    secret: input.secret,
    issuer: input.issuer,
    algorithm: "SHA1",
    digits: String(input.digits ?? 6),
    period: String(input.stepSeconds ?? 30),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
