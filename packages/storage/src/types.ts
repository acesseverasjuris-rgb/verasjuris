import type { Readable } from "node:stream";

export type PutObjectInput = {
  key: string;
  body: Readable | Buffer | Uint8Array;
  contentType: string;
  contentLength?: number;
};

export type PutObjectResult = {
  key: string;
  sizeBytes: number;
  etag?: string;
};

export type GetObjectResult = {
  stream: Readable;
  contentType?: string;
  sizeBytes?: number;
};

export type TemporaryDownloadUrl = {
  url: string;
  expiresAt: Date;
};

export type HeadObjectResult = {
  sizeBytes: number;
  contentType?: string;
};

/**
 * Provider de object storage privado (nunca sob `apps/web/public`).
 * Download temporário via URL assinada é opcional — o adapter local
 * pode preferir tokens assinados pela aplicação.
 */
export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<PutObjectResult>;
  getObject(key: string): Promise<GetObjectResult>;
  createTemporaryDownloadUrl?(key: string, ttlSeconds: number): Promise<TemporaryDownloadUrl>;
  objectExists(key: string): Promise<boolean>;
  deleteObject(key: string): Promise<void>;
  headObject?(key: string): Promise<HeadObjectResult>;
}

export type MalwareScanStatus = "NOT_CONFIGURED" | "PENDING" | "CLEAN" | "INFECTED" | "ERROR";

export type MalwareScanInput = {
  key?: string;
  body?: Readable | Buffer | Uint8Array;
  contentType?: string;
  filename?: string;
};

export type MalwareScanResult = {
  status: MalwareScanStatus;
  detail?: string;
};

export interface MalwareScannerProvider {
  readonly status: "NOT_CONFIGURED" | "configured";
  scan(input: MalwareScanInput): Promise<MalwareScanResult>;
}
