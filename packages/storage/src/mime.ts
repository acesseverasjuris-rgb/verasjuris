import { AppError } from "@verasjuris/types";
import { z } from "zod";

export const ALLOWED_UPLOAD_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "text/plain",
] as const;

export type AllowedUploadMime = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

const allowedSet = new Set<string>(ALLOWED_UPLOAD_MIME_TYPES);

const assertAllowedUploadSchema = z.object({
  declaredMime: z.string().min(1),
  detectedMime: z.string().nullable(),
  filename: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  maxBytes: z.number().int().positive(),
});

export type AssertAllowedUploadInput = z.infer<typeof assertAllowedUploadSchema>;

function looksLikeTextPlain(buffer: Uint8Array): boolean {
  if (buffer.length === 0) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 512));
  let printable = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (
      byte === 0x09 ||
      byte === 0x0a ||
      byte === 0x0d ||
      (byte >= 0x20 && byte <= 0x7e) ||
      byte >= 0x80
    ) {
      printable += 1;
    }
  }
  return printable / sample.length >= 0.85;
}

/** Detecta MIME a partir de magic bytes (PDF, JPEG, PNG) ou heurística de texto. */
export function detectMimeFromMagicBytes(buffer: Uint8Array): string | null {
  if (buffer.length >= 4) {
    // %PDF
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
      return "application/pdf";
    }
  }

  if (buffer.length >= 3) {
    // JPEG FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return "image/jpeg";
    }
  }

  if (buffer.length >= 8) {
    // PNG 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return "image/png";
    }
  } else if (buffer.length >= 4) {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return "image/png";
    }
  }

  if (looksLikeTextPlain(buffer)) {
    return "text/plain";
  }

  return null;
}

export function isAllowedUploadMime(mime: string): mime is AllowedUploadMime {
  return allowedSet.has(mime);
}

/**
 * Garante tipo declarado permitido, coerente com magic bytes, e tamanho dentro do limite.
 */
export function assertAllowedUpload(input: AssertAllowedUploadInput): AllowedUploadMime {
  const parsed = assertAllowedUploadSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Metadados de upload inválidos.", [
      ...parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    ]);
  }

  const { declaredMime, detectedMime, filename, sizeBytes, maxBytes } = parsed.data;

  if (sizeBytes > maxBytes) {
    throw new AppError("VALIDATION_ERROR", `Arquivo excede o tamanho máximo de ${maxBytes} bytes.`);
  }

  if (!isAllowedUploadMime(declaredMime)) {
    throw new AppError("VALIDATION_ERROR", `Tipo MIME não permitido: ${declaredMime}.`);
  }

  if (detectedMime !== null && detectedMime !== declaredMime) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Tipo declarado (${declaredMime}) diverge do detectado (${detectedMime}).`,
    );
  }

  if (detectedMime === null && declaredMime !== "text/plain") {
    throw new AppError(
      "VALIDATION_ERROR",
      `Não foi possível confirmar o tipo do arquivo "${filename}".`,
    );
  }

  return declaredMime;
}
