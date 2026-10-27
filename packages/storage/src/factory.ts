import { AppError } from "@verasjuris/types";
import { z } from "zod";
import { LocalPrivateStorageProvider } from "./local-private-storage.js";
import { NotConfiguredMalwareScanner } from "./malware.js";
import type {
  GetObjectResult,
  MalwareScannerProvider,
  PutObjectInput,
  PutObjectResult,
  StorageProvider,
} from "./types.js";

const storageEnvSchema = z.object({
  STORAGE_PROVIDER: z.string().optional(),
  LOCAL_STORAGE_PATH: z.string().optional(),
  NODE_ENV: z.string().optional(),
  ALLOW_LOCAL_STORAGE_IN_PRODUCTION: z.string().optional(),
});

export type StorageFactoryEnv = z.infer<typeof storageEnvSchema> | NodeJS.ProcessEnv;

const NOT_CONFIGURED_MESSAGE = "O object storage ainda não está configurado neste ambiente.";

/** Provider que falha em put/get com AppError NOT_CONFIGURED. */
export class NotConfiguredStorageProvider implements StorageProvider {
  readonly status = "NOT_CONFIGURED" as const;

  async putObject(_input: PutObjectInput): Promise<PutObjectResult> {
    throw new AppError("NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  }

  async getObject(_key: string): Promise<GetObjectResult> {
    throw new AppError("NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  }

  async objectExists(_key: string): Promise<boolean> {
    throw new AppError("NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  }

  async deleteObject(_key: string): Promise<void> {
    throw new AppError("NOT_CONFIGURED", NOT_CONFIGURED_MESSAGE);
  }
}

function isProduction(env: StorageFactoryEnv): boolean {
  return (env.NODE_ENV ?? process.env.NODE_ENV) === "production";
}

/**
 * Factory de storage.
 * - `local`: apenas fora de production (ou com ALLOW_LOCAL_STORAGE_IN_PRODUCTION=1)
 * - `not_configured` / ausente: provider que lança NOT_CONFIGURED
 * Não implementa AWS/S3.
 */
export function createStorageProvider(env: StorageFactoryEnv = process.env): StorageProvider {
  const parsed = storageEnvSchema.parse({
    STORAGE_PROVIDER: env.STORAGE_PROVIDER,
    LOCAL_STORAGE_PATH: env.LOCAL_STORAGE_PATH,
    NODE_ENV: env.NODE_ENV ?? process.env.NODE_ENV,
    ALLOW_LOCAL_STORAGE_IN_PRODUCTION: env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION,
  });

  const mode = (parsed.STORAGE_PROVIDER ?? "not_configured").toLowerCase();

  if (mode === "not_configured" || mode === "") {
    return new NotConfiguredStorageProvider();
  }

  if (mode === "local") {
    if (isProduction(parsed)) {
      const allowed = parsed.ALLOW_LOCAL_STORAGE_IN_PRODUCTION === "1";
      if (!allowed) {
        throw new AppError(
          "NOT_CONFIGURED",
          "STORAGE_PROVIDER=local não é permitido em production. Configure um provider real ou use not_configured.",
        );
      }
    }

    const root = parsed.LOCAL_STORAGE_PATH;
    if (!root || root.trim().length === 0) {
      throw new AppError(
        "NOT_CONFIGURED",
        "LOCAL_STORAGE_PATH é obrigatório quando STORAGE_PROVIDER=local.",
      );
    }

    return new LocalPrivateStorageProvider(root);
  }

  throw new AppError(
    "NOT_CONFIGURED",
    `STORAGE_PROVIDER desconhecido ou não implementado: ${mode}.`,
  );
}

/** Nenhum antivírus externo está conectado nesta etapa. */
export function createMalwareScanner(
  _env: StorageFactoryEnv = process.env,
): MalwareScannerProvider {
  return new NotConfiguredMalwareScanner();
}
