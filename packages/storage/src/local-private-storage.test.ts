import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { AppError } from "@verasjuris/types";
import { assertSafeStorageKey, LocalPrivateStorageProvider } from "./local-private-storage.js";

const ORG = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const DOC = "b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
const KEY = `${ORG}/${DOC}`;

describe("assertSafeStorageKey", () => {
  it("aceita caminhos só com segmentos UUID", () => {
    expect(assertSafeStorageKey(KEY)).toBe(KEY);
    expect(assertSafeStorageKey(ORG)).toBe(ORG);
  });

  it("rejeita path traversal e caminhos absolutos", () => {
    expect(() => assertSafeStorageKey("../etc/passwd")).toThrow(AppError);
    expect(() => assertSafeStorageKey(`${ORG}/../${DOC}`)).toThrow(AppError);
    expect(() => assertSafeStorageKey(`/tmp/${ORG}`)).toThrow(AppError);
    expect(() => assertSafeStorageKey(`${ORG}/not-a-uuid`)).toThrow(AppError);
    expect(() => assertSafeStorageKey(`${ORG}/\0${DOC}`)).toThrow(AppError);
    expect(() => assertSafeStorageKey(`..\\${ORG}`)).toThrow(AppError);
  });
});

describe("LocalPrivateStorageProvider", () => {
  let root: string;

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("é marcado DEV_LOCAL e grava fora de public", async () => {
    root = await mkdtemp(path.join(tmpdir(), "verasjuris-storage-"));
    const provider = new LocalPrivateStorageProvider(root);
    expect(provider.tag).toBe("DEV_LOCAL");
    expect(provider.root.startsWith(path.resolve("apps/web/public"))).toBe(false);

    const body = Buffer.from("%PDF-1.4 hello");
    const put = await provider.putObject({
      key: KEY,
      body,
      contentType: "application/pdf",
    });
    expect(put.key).toBe(KEY);
    expect(put.sizeBytes).toBe(body.length);

    expect(await provider.objectExists(KEY)).toBe(true);
    const got = await provider.getObject(KEY);
    expect(got.contentType).toBe("application/pdf");
    expect(got.sizeBytes).toBe(body.length);

    const chunks: Buffer[] = [];
    for await (const chunk of got.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).equals(body)).toBe(true);

    const onDisk = await readFile(path.join(root, ORG, DOC));
    expect(onDisk.equals(body)).toBe(true);

    await provider.deleteObject(KEY);
    expect(await provider.objectExists(KEY)).toBe(false);
  });

  it("aceita Readable e rejeita chave insegura em put", async () => {
    root = await mkdtemp(path.join(tmpdir(), "verasjuris-storage-"));
    const provider = new LocalPrivateStorageProvider(root);

    await provider.putObject({
      key: KEY,
      body: Readable.from([Buffer.from("plain text")]),
      contentType: "text/plain",
    });
    expect(await provider.objectExists(KEY)).toBe(true);

    await expect(
      provider.putObject({
        key: `../${DOC}`,
        body: Buffer.from("x"),
        contentType: "text/plain",
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("recusa raiz sob apps/web/public", () => {
    expect(() => new LocalPrivateStorageProvider("apps/web/public")).toThrow(AppError);
    expect(() => new LocalPrivateStorageProvider("apps/web/public/uploads")).toThrow(AppError);
  });
});
