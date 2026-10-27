import { describe, expect, it } from "vitest";
import { AppError } from "@verasjuris/types";
import { assertAllowedUpload, detectMimeFromMagicBytes } from "./mime.js";

describe("detectMimeFromMagicBytes", () => {
  it("detecta PDF, JPEG e PNG", () => {
    expect(detectMimeFromMagicBytes(Buffer.from("%PDF-1.7\n"))).toBe("application/pdf");
    expect(detectMimeFromMagicBytes(Uint8Array.of(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(
      detectMimeFromMagicBytes(Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe("image/png");
  });

  it("usa heurística de text/plain", () => {
    expect(detectMimeFromMagicBytes(Buffer.from("Olá, documento texto."))).toBe("text/plain");
  });

  it("retorna null para binário desconhecido", () => {
    expect(detectMimeFromMagicBytes(Uint8Array.of(0x00, 0x01, 0x02, 0xff))).toBeNull();
  });
});

describe("assertAllowedUpload", () => {
  it("aceita upload coerente na allowlist", () => {
    expect(
      assertAllowedUpload({
        declaredMime: "application/pdf",
        detectedMime: "application/pdf",
        filename: "peticao.pdf",
        sizeBytes: 100,
        maxBytes: 1_000_000,
      }),
    ).toBe("application/pdf");
  });

  it("rejeita MIME fora da allowlist, divergência e tamanho", () => {
    expect(() =>
      assertAllowedUpload({
        declaredMime: "application/zip",
        detectedMime: "application/zip",
        filename: "x.zip",
        sizeBytes: 10,
        maxBytes: 100,
      }),
    ).toThrow(AppError);

    expect(() =>
      assertAllowedUpload({
        declaredMime: "image/jpeg",
        detectedMime: "image/png",
        filename: "foto.jpg",
        sizeBytes: 10,
        maxBytes: 100,
      }),
    ).toThrow(AppError);

    expect(() =>
      assertAllowedUpload({
        declaredMime: "text/plain",
        detectedMime: "text/plain",
        filename: "grande.txt",
        sizeBytes: 200,
        maxBytes: 100,
      }),
    ).toThrow(AppError);
  });
});
