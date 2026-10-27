import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

const databaseUrl = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
    "DATABASE_URL deve ser uma URL PostgreSQL.",
  );

/** Variáveis opcionais podem vir vazias (`VAR=`) do .env.example; vazio equivale a ausente. */
const emptyToUndefined = (value: unknown): unknown =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().min(1).max(200).optional());

const optionalInt = (min: number, max: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(min).max(max).optional());

export const apiEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: databaseUrl,
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://127.0.0.1:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  EMAIL_PROVIDER: z.enum(["not_configured", "memory"]).default("not_configured"),
  STORAGE_PROVIDER: z.enum(["not_configured", "local"]).default("not_configured"),
  LOCAL_STORAGE_PATH: z.string().min(1).default(".data/private-storage"),
  ALLOW_LOCAL_STORAGE_IN_PRODUCTION: z.enum(["0", "1"]).default("0"),
  DOCUMENT_MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(100).default(10),
  MALWARE_SCANNER_PROVIDER: z.enum(["not_configured"]).default("not_configured"),
  TEMPORARY_URL_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(120),
  DOCUMENT_DOWNLOAD_TOKEN_SECRET: z.string().min(16).optional(),
  /** Provedores de IA/OCR/oportunidades públicas: somente not_configured até haver integração real. */
  AI_PROVIDER: z.enum(["not_configured"]).default("not_configured"),
  AI_DEFAULT_MODEL: optionalString,
  AI_REQUEST_TIMEOUT_MS: optionalInt(1_000, 300_000),
  AI_MAX_RETRIES: optionalInt(0, 5),
  AI_MAX_INPUT_TOKENS: optionalInt(1, 2_000_000),
  /** Orçamento mensal em micros inteiros (1 unidade monetária = 1_000_000 micros). */
  AI_MONTHLY_BUDGET_MICROS: optionalInt(0, Number.MAX_SAFE_INTEGER),
  OCR_PROVIDER: z.enum(["not_configured"]).default("not_configured"),
  PUBLIC_OPPORTUNITY_PROVIDER: z.enum(["not_configured"]).default("not_configured"),
  AUCTION_PROVIDER: z.enum(["not_configured"]).default("not_configured"),
  LEGAL_SOURCE_PROVIDER: z.enum(["not_configured"]).default("not_configured"),
});

export const workerEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: databaseUrl,
  WORKER_HOST: z.string().min(1).default("127.0.0.1"),
  WORKER_PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const seedEnvSchema = z.object({
  DATABASE_URL: databaseUrl,
  SEED_USER_NAME: z.string().optional().default(""),
  SEED_USER_EMAIL: z.string().optional().default(""),
  SEED_USER_PASSWORD: z.string().optional().default(""),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;
export type WorkerEnv = z.infer<typeof workerEnvSchema>;
export type SeedEnv = z.infer<typeof seedEnvSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "ambiente"}: ${issue.message}`)
    .join("; ");
}

export function parseApiEnv(env: NodeJS.ProcessEnv): ApiEnv {
  const parsed = apiEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Ambiente da API inválido. ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

export function parseWorkerEnv(env: NodeJS.ProcessEnv): WorkerEnv {
  const parsed = workerEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Ambiente do worker inválido. ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

export function parseSeedEnv(env: NodeJS.ProcessEnv): SeedEnv {
  const parsed = seedEnvSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Ambiente do seed inválido. ${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

export function loadDotEnv(startDirectory = process.cwd()): void {
  let directory = startDirectory;
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = path.join(directory, ".env");
    if (existsSync(candidate)) {
      const contents = readFileSync(candidate, "utf8");
      for (const line of contents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separator = trimmed.indexOf("=");
        if (separator <= 0) continue;
        const key = trimmed.slice(0, separator).trim();
        const rawValue = trimmed.slice(separator + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, "");
        if (process.env[key] === undefined) process.env[key] = value;
      }
      return;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}
