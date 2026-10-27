import pino, { type Logger } from "pino";

const REDACT_PATHS = [
  "password",
  "passwordHash",
  "password_hash",
  "token",
  "sessionToken",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "secret",
  "authorization",
  "cookie",
  "card",
  "cardNumber",
  "pan",
  "cvv",
  "biometric",
  "biometria",
  "req.headers.authorization",
  "req.headers.cookie",
  "*.password",
  "*.passwordHash",
  "*.token",
  "*.secret",
  "*.authorization",
  "*.cookie",
];

export function createLogger(
  service: "api" | "worker" | "database",
  level: "debug" | "info" | "warn" | "error",
): Logger {
  return pino({
    level,
    base: { service },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  });
}
