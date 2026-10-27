import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import {
  assertAllowedUpload,
  createSha256Hasher,
  detectMimeFromMagicBytes,
  safeDisplayFilename,
  sanitizeOriginalFilename,
  type MalwareScannerProvider,
  type StorageProvider,
} from "@verasjuris/storage";
import { AppError } from "@verasjuris/types";
import type { FastifyRequest } from "fastify";

export type UploadedFilePayload = {
  filename: string;
  mimetype: string;
  data: Buffer;
  /** Hash calculado progressivamente durante o buffering (quando disponível). */
  sha256?: string;
};

export type ProcessedUpload = {
  originalFilename: string;
  safeFilename: string;
  mimeTypeDeclared: string;
  mimeTypeDetected: string;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
  storageProvider: string;
  scanStatus: "not_configured" | "pending" | "clean" | "infected" | "error";
  scanProvider: string | null;
  scanResult: string | null;
  versionStatus: "available" | "quarantined" | "rejected";
};

export function buildDocumentStorageKey(parts: {
  organizationId: string;
  documentId: string;
  versionId: string;
}): string {
  return `${parts.organizationId}/${parts.documentId}/${parts.versionId}`;
}

export async function processDocumentUpload(input: {
  file: UploadedFilePayload;
  maxBytes: number;
  organizationId: string;
  documentId: string;
  versionId?: string;
  storage: StorageProvider;
  scanner: MalwareScannerProvider;
}): Promise<ProcessedUpload> {
  const originalFilename = sanitizeOriginalFilename(input.file.filename);
  if (!originalFilename || originalFilename.includes("..")) {
    throw new AppError("VALIDATION_ERROR", "Nome de arquivo inválido.", [
      { path: "file", message: "O nome do arquivo contém componentes inseguros." },
    ]);
  }
  const safeFilename = safeDisplayFilename(originalFilename);
  const sizeBytes = input.file.data.byteLength;
  const declaredMime = (
    (input.file.mimetype || "application/octet-stream").split(";")[0] ?? "application/octet-stream"
  ).trim();
  const detectedMime = detectMimeFromMagicBytes(input.file.data);

  assertAllowedUpload({
    declaredMime,
    detectedMime,
    filename: safeFilename,
    sizeBytes,
    maxBytes: input.maxBytes,
  });

  const sha256 =
    input.file.sha256 ??
    (() => {
      const hasher = createSha256Hasher();
      hasher.update(input.file.data);
      return hasher.digestHex();
    })();

  const versionId = input.versionId ?? randomUUID();
  const storageKey = buildDocumentStorageKey({
    organizationId: input.organizationId,
    documentId: input.documentId,
    versionId,
  });

  const put = await input.storage.putObject({
    key: storageKey,
    body: Readable.from(input.file.data),
    contentType: declaredMime,
    contentLength: sizeBytes,
  });

  const scan = await input.scanner.scan({
    key: storageKey,
    body: input.file.data,
    contentType: declaredMime,
    filename: safeFilename,
  });

  let scanStatus: ProcessedUpload["scanStatus"] = "not_configured";
  let versionStatus: ProcessedUpload["versionStatus"] = "available";
  if (scan.status === "NOT_CONFIGURED") {
    scanStatus = "not_configured";
    versionStatus = "available";
  } else if (scan.status === "CLEAN") {
    scanStatus = "clean";
    versionStatus = "available";
  } else if (scan.status === "INFECTED") {
    scanStatus = "infected";
    versionStatus = "quarantined";
  } else if (scan.status === "PENDING") {
    scanStatus = "pending";
    versionStatus = "quarantined";
  } else {
    scanStatus = "error";
    versionStatus = "available";
  }

  return {
    originalFilename,
    safeFilename,
    mimeTypeDeclared: declaredMime,
    mimeTypeDetected: detectedMime ?? declaredMime,
    sizeBytes,
    sha256,
    storageKey: put.key,
    storageProvider:
      input.storage.constructor.name === "LocalPrivateStorageProvider" ? "local" : "configured",
    scanStatus,
    scanProvider: input.scanner.status === "NOT_CONFIGURED" ? null : "configured",
    scanResult: scan.detail ?? null,
    versionStatus,
  };
}

type MultipartFilePart = {
  filename?: string;
  mimetype?: string;
  toBuffer?: () => Promise<Buffer>;
  file?: NodeJS.ReadableStream & { truncated?: boolean; toArray?: () => Promise<Buffer[]> };
};

type MultipartRequest = FastifyRequest & {
  file: (options?: { limits?: { fileSize?: number } }) => Promise<MultipartFilePart | null>;
};

/**
 * Lê o part multipart atualizando SHA-256 por chunk enquanto monta o buffer.
 * O buffer completo ainda é necessário para o malware scanner síncrono atual —
 * ver `docs/SECURE_UPLOAD.md` (dívida residual: scan sem buffer integral).
 */
export async function readMultipartFile(
  request: FastifyRequest,
  maxBytes: number,
): Promise<UploadedFilePayload> {
  const multipartRequest = request as MultipartRequest;
  if (typeof multipartRequest.file !== "function") {
    throw new AppError("VALIDATION_ERROR", "Envio multipart não está disponível neste endpoint.");
  }
  const part = await multipartRequest.file({ limits: { fileSize: maxBytes } });
  if (!part) {
    throw new AppError("VALIDATION_ERROR", "Envie um arquivo no campo file.", [
      { path: "file", message: "Arquivo obrigatório." },
    ]);
  }

  const hasher = createSha256Hasher();
  const chunks: Buffer[] = [];
  let total = 0;

  const stream = part.file;
  if (stream && typeof (stream as NodeJS.ReadableStream).on === "function") {
    await new Promise<void>((resolve, reject) => {
      stream.on("data", (chunk: Buffer | string) => {
        const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        total += buf.byteLength;
        if (total > maxBytes) {
          stream.destroy?.();
          reject(
            new AppError(
              "VALIDATION_ERROR",
              `Arquivo excede o tamanho máximo de ${maxBytes} bytes.`,
            ),
          );
          return;
        }
        hasher.update(buf);
        chunks.push(buf);
      });
      stream.on("end", () => resolve());
      stream.on("error", (error: Error) => reject(error));
    });
  } else {
    const data: Buffer =
      typeof part.toBuffer === "function"
        ? await part.toBuffer()
        : Buffer.concat(await (part.file?.toArray?.() ?? Promise.resolve([])));
    if (data.byteLength > maxBytes) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Arquivo excede o tamanho máximo de ${maxBytes} bytes.`,
      );
    }
    hasher.update(data);
    chunks.push(data);
    total = data.byteLength;
  }

  if (part.file?.truncated || total > maxBytes) {
    throw new AppError("VALIDATION_ERROR", `Arquivo excede o tamanho máximo de ${maxBytes} bytes.`);
  }

  return {
    filename: part.filename || "arquivo",
    mimetype: part.mimetype || "application/octet-stream",
    data: Buffer.concat(chunks, total),
    sha256: hasher.digestHex(),
  };
}
