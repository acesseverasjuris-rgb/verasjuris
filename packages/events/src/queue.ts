import { randomUUID } from "node:crypto";

/**
 * Fila de trabalhos.
 *
 * Produção / padrão: `NotConfiguredJobQueue` — sem broker e sem fallback silencioso.
 * Desenvolvimento/teste explícito: `LocalInProcessQueueProvider` quando
 * `FEATURE_LOCAL_QUEUE=true`/`1` ou `LOCAL_QUEUE=enabled`.
 *
 * Isto NÃO é fila distribuída: handlers rodam no mesmo processo via `processNext`.
 */

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type JobRecord = {
  id: string;
  type: string;
  payload: unknown;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  idempotencyKey: string | null;
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type JobEnqueueOptions = {
  idempotencyKey?: string;
  maxAttempts?: number;
};

export type JobHandler = (job: JobRecord) => Promise<void>;

export type JobQueueStatus = "not_configured" | "local_in_process";

export interface JobQueue {
  readonly status: JobQueueStatus;
  enqueue(type: string, payload: unknown, options?: JobEnqueueOptions): Promise<JobRecord>;
  processNext(): Promise<JobRecord | null>;
  cancel(id: string): Promise<JobRecord | null>;
  getJob(id: string): Promise<JobRecord | null>;
}

const NOT_CONFIGURED_MESSAGE =
  "A fila de trabalhos não está configurada. Nenhum trabalho foi agendado.";

export class NotConfiguredJobQueue implements JobQueue {
  readonly status = "not_configured" as const;

  enqueue(_type: string, _payload: unknown, _options?: JobEnqueueOptions): Promise<JobRecord> {
    return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
  }

  processNext(): Promise<JobRecord | null> {
    return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
  }

  cancel(_id: string): Promise<JobRecord | null> {
    return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
  }

  getJob(_id: string): Promise<JobRecord | null> {
    return Promise.reject(new Error(NOT_CONFIGURED_MESSAGE));
  }
}

export type LocalInProcessQueueOptions = {
  /** Handlers por `type`. Sem handler o job falha com lastError explícito. */
  handlers?: Readonly<Record<string, JobHandler>>;
  now?: () => Date;
  createId?: () => string;
};

/**
 * Fila local em processo: enqueue real + execução sob demanda em `processNext`.
 * Ativar somente via env explícito — nunca como fallback silencioso de produção.
 */
export class LocalInProcessQueueProvider implements JobQueue {
  readonly status = "local_in_process" as const;
  private readonly jobs = new Map<string, JobRecord>();
  private readonly byIdempotency = new Map<string, string>();
  private readonly handlers: Map<string, JobHandler>;
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly queueOrder: string[] = [];

  constructor(options: LocalInProcessQueueOptions = {}) {
    this.handlers = new Map(Object.entries(options.handlers ?? {}));
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? (() => randomUUID());
  }

  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
  }

  async enqueue(
    type: string,
    payload: unknown,
    options: JobEnqueueOptions = {},
  ): Promise<JobRecord> {
    const key = options.idempotencyKey?.trim() || null;
    if (key) {
      const existingId = this.byIdempotency.get(key);
      if (existingId) {
        const existing = this.jobs.get(existingId);
        if (existing) return { ...existing };
      }
    }
    const createdAt = this.now().toISOString();
    const id = this.createId();
    const maxAttempts = Math.min(Math.max(options.maxAttempts ?? 3, 1), 20);
    const job: JobRecord = {
      id,
      type,
      payload,
      status: "queued",
      attempts: 0,
      maxAttempts,
      idempotencyKey: key,
      lastError: null,
      createdAt,
      startedAt: null,
      completedAt: null,
    };
    this.jobs.set(id, job);
    this.queueOrder.push(id);
    if (key) this.byIdempotency.set(key, id);
    return { ...job };
  }

  async processNext(): Promise<JobRecord | null> {
    const nextId = this.queueOrder.find((id) => this.jobs.get(id)?.status === "queued");
    if (!nextId) return null;
    const job = this.jobs.get(nextId);
    if (!job || job.status !== "queued") return null;

    const startedAt = this.now().toISOString();
    const running: JobRecord = {
      ...job,
      status: "running",
      attempts: job.attempts + 1,
      startedAt,
      lastError: null,
    };
    this.jobs.set(nextId, running);

    const handler = this.handlers.get(running.type);
    if (!handler) {
      const failed: JobRecord = {
        ...running,
        status: "failed",
        lastError: "JOB_HANDLER_NOT_REGISTERED",
        completedAt: this.now().toISOString(),
      };
      this.jobs.set(nextId, failed);
      return { ...failed };
    }

    try {
      await handler(running);
      const succeeded: JobRecord = {
        ...running,
        status: "succeeded",
        completedAt: this.now().toISOString(),
        lastError: null,
      };
      this.jobs.set(nextId, succeeded);
      return { ...succeeded };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "JOB_FAILED";
      const retry = running.attempts < running.maxAttempts;
      const after: JobRecord = {
        ...running,
        status: retry ? "queued" : "failed",
        lastError: message,
        completedAt: retry ? null : this.now().toISOString(),
        startedAt: retry ? null : running.startedAt,
      };
      this.jobs.set(nextId, after);
      return { ...after };
    }
  }

  async cancel(id: string): Promise<JobRecord | null> {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (job.status === "succeeded" || job.status === "cancelled") return { ...job };
    const cancelled: JobRecord = {
      ...job,
      status: "cancelled",
      completedAt: this.now().toISOString(),
    };
    this.jobs.set(id, cancelled);
    return { ...cancelled };
  }

  async getJob(id: string): Promise<JobRecord | null> {
    const job = this.jobs.get(id);
    return job ? { ...job } : null;
  }
}

/** Compat: sempre not_configured (sem fallback silencioso). */
export function createJobQueue(): JobQueue {
  return new NotConfiguredJobQueue();
}

export type JobQueueEnv = {
  FEATURE_LOCAL_QUEUE?: string | boolean;
  LOCAL_QUEUE?: string;
};

function isLocalQueueEnabled(env: JobQueueEnv): boolean {
  const feature = env.FEATURE_LOCAL_QUEUE;
  if (feature === true || feature === "1" || feature === "true") return true;
  return env.LOCAL_QUEUE === "enabled";
}

/**
 * Produção: NOT_CONFIGURED.
 * Dev/teste: LocalInProcess somente com FEATURE_LOCAL_QUEUE=true|1 ou LOCAL_QUEUE=enabled.
 */
export function createJobQueueFromEnv(
  env: JobQueueEnv,
  options: LocalInProcessQueueOptions = {},
): JobQueue {
  if (isLocalQueueEnabled(env)) {
    return new LocalInProcessQueueProvider(options);
  }
  return new NotConfiguredJobQueue();
}
