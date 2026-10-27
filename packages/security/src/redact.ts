const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "token",
  "sessiontoken",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "secret",
  "authorization",
  "cookie",
  "card",
  "cardnumber",
  "pan",
  "biometric",
  "biometria",
  "cvv",
]);

function isSensitive(key: string): boolean {
  const normalized = key.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
  return SENSITIVE_KEYS.has(normalized);
}

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item));
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    output[key] = isSensitive(key) ? "[redacted]" : redactSensitive(nested);
  }
  return output;
}
