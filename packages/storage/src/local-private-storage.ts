import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AppError } from "@verasjuris/types";
import type {
  GetObjectResult,
  HeadObjectResult,
  PutObjectInput,
  PutObjectResult,
  StorageProvider,
} from "./types.js";

const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ObjectMeta = {
  contentType?: string;
  sizeBytes?: number;
};

/**
 * Valida chave de storage: apenas segmentos UUID, sem traversal.
 * Ex.: `a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11/b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11`
 */
export function assertSafeStorageKey(key: string): string {
  if (typeof key !== "string" || key.length === 0) {
    throw new AppError("VALIDATION_ERROR", "Chave de storage inválida.");
  }
  if (key.includes("\0")) {
    throw new AppError("VALIDATION_ERROR", "Chave de storage contém byte nulo.");
  }
  if (path.isAbsolute(key) || key.startsWith("/") || /^[a-zA-Z]:[\\/]/.test(key)) {
    throw new AppError("VALIDATION_ERROR", "Chave de storage não pode ser caminho absoluto.");
  }
  if (key.includes("\\")) {
    throw new AppError("VALIDATION_ERROR", "Chave de storage não pode conter barras invertidas.");
  }

  const segments = key.split("/");
  for (const segment of segments) {
    if (!segment || segment === "." || segment === "..") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Chave de storage rejeitada: segmento de caminho inseguro.",
      );
    }
    if (!UUID_SEGMENT.test(segment)) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Chave de storage deve ser composta apenas por segmentos UUID.",
      );
    }
  }

  return key;
}

function resolveStorageRoot(rawPath: string): string {
  const resolved = path.isAbsolute(rawPath)
    ? path.normalize(rawPath)
    : path.resolve(process.cwd(), rawPath);

  const publicDir = path.resolve(process.cwd(), "apps/web/public");
  if (resolved === publicDir || resolved.startsWith(`${publicDir}${path.sep}`)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "LOCAL_STORAGE_PATH não pode apontar para apps/web/public (arquivos privados).",
    );
  }

  return resolved;
}

function resolveObjectPath(root: string, key: string): string {
  const safeKey = assertSafeStorageKey(key);
  const fullPath = path.resolve(root, ...safeKey.split("/"));
  if (fullPath !== root && !fullPath.startsWith(`${root}${path.sep}`)) {
    throw new AppError("VALIDATION_ERROR", "Chave de storage escapa do diretório raiz.");
  }
  return fullPath;
}

function toReadable(body: Readable | Buffer | Uint8Array): Readable {
  if (body instanceof Readable) return body;
  return Readable.from(Buffer.isBuffer(body) ? body : Buffer.from(body));
}

/**
 * Object storage privado local — apenas desenvolvimento (`DEV_LOCAL`).
 * Arquivos ficam fora de `apps/web/public`; nunca são servidos como estáticos.
 */
export class LocalPrivateStorageProvider implements StorageProvider {
  /** Marcação explícita: adapter de desenvolvimento, não produção. */
  readonly tag = "DEV_LOCAL" as const;
  readonly root: string;

  constructor(rootPath: string) {
    this.root = resolveStorageRoot(rootPath);
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const objectPath = resolveObjectPath(this.root, input.key);
    await mkdir(path.dirname(objectPath), { recursive: true });

    let sizeBytes = 0;
    const counter = new Transform({
      transform(chunk, _encoding, callback) {
        sizeBytes += chunk.length as number;
        callback(null, chunk);
      },
    });

    await pipeline(toReadable(input.body), counter, createWriteStream(objectPath));

    if (input.contentLength !== undefined && input.contentLength !== sizeBytes) {
      await unlink(objectPath).catch(() => undefined);
      throw new AppError("VALIDATION_ERROR", "Tamanho do objeto não corresponde a contentLength.");
    }

    await writeFile(
      `${objectPath}.meta.json`,
      JSON.stringify({ contentType: input.contentType, sizeBytes }),
      "utf8",
    );

    return { key: input.key, sizeBytes };
  }

  async getObject(key: string): Promise<GetObjectResult> {
    const objectPath = resolveObjectPath(this.root, key);
    try {
      await access(objectPath);
    } catch {
      throw new AppError("NOT_FOUND", "Objeto não encontrado no storage local.");
    }

    const meta = await this.readMeta(objectPath);
    const fileStat = await stat(objectPath);
    return {
      stream: createReadStream(objectPath),
      contentType: meta?.contentType,
      sizeBytes: meta?.sizeBytes ?? fileStat.size,
    };
  }

  async objectExists(key: string): Promise<boolean> {
    const objectPath = resolveObjectPath(this.root, key);
    try {
      await access(objectPath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteObject(key: string): Promise<void> {
    const objectPath = resolveObjectPath(this.root, key);
    try {
      await unlink(objectPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }
    try {
      await unlink(`${objectPath}.meta.json`);
    } catch {
      // meta opcional
    }
  }

  async headObject(key: string): Promise<HeadObjectResult> {
    const objectPath = resolveObjectPath(this.root, key);
    try {
      const fileStat = await stat(objectPath);
      const meta = await this.readMeta(objectPath);
      return {
        sizeBytes: meta?.sizeBytes ?? fileStat.size,
        contentType: meta?.contentType,
      };
    } catch {
      throw new AppError("NOT_FOUND", "Objeto não encontrado no storage local.");
    }
  }

  private async readMeta(objectPath: string): Promise<ObjectMeta | null> {
    try {
      const raw = await readFile(`${objectPath}.meta.json`, "utf8");
      return JSON.parse(raw) as ObjectMeta;
    } catch {
      return null;
    }
  }
}
