import { aiJobs, type AppDatabase } from "@verasjuris/database";
import { and, asc, eq, sql } from "drizzle-orm";

/**
 * Executor LOCAL e EM PROCESSO para `ai_jobs` (runtime `local_in_process`).
 *
 * Isto NÃO é uma fila distribuída: não há broker, lease entre processos, nem garantia de entrega.
 * É uma varredura explícita (`runOnce`) que reivindica jobs `queued` por compare-and-set no banco e os
 * entrega a handlers registrados. Sem handler para o tipo, o job vira `not_configured` — nada é
 * simulado. O worker NÃO inicia este executor sozinho; quem o quiser deve chamá-lo de forma explícita.
 */

export const LOCAL_IN_PROCESS_RUNTIME = "local_in_process" as const;

/**
 * Tipos conhecidos de `ai_jobs`. Sem handler registrado o executor marca `not_configured`
 * (nada é simulado). LEGAL_REVIEW fica sem handler até haver processamento assíncrono.
 */
export const AI_JOB_TYPES = {
  LEGAL_ANALYSIS: "legal_analysis",
  LEGAL_REVIEW: "legal_review",
  DOCUMENT_INTELLIGENCE: "document_intelligence",
  /** Sync externo de leilões — sem handler ⇒ not_configured (não inventa leilões). */
  AUCTION_SYNC: "AUCTION_SYNC",
  /** Checagem de alertas de leilão — stub not_configured. */
  AUCTION_ALERT_CHECK: "AUCTION_ALERT_CHECK",
  /** Análise de documento de leilão — stub not_configured. */
  AUCTION_DOCUMENT_ANALYSIS: "AUCTION_DOCUMENT_ANALYSIS",
  /** Importação de ponto trabalhista — stub not_configured. */
  LABOR_TIME_IMPORT: "LABOR_TIME_IMPORT",
  /** Cálculo trabalhista assíncrono — stub not_configured. */
  LABOR_CALCULATION: "LABOR_CALCULATION",
  /** Análise documental trabalhista — stub not_configured. */
  LABOR_DOCUMENT_ANALYSIS: "LABOR_DOCUMENT_ANALYSIS",
  /** Importação CNIS assíncrona — stub not_configured (sem inventar CNIS). */
  CNIS_IMPORT: "CNIS_IMPORT",
  /** Cálculo previdenciário assíncrono — stub not_configured. */
  PREVIDENTIARY_CALCULATION: "PREVIDENTIARY_CALCULATION",
  /** Análise documental previdenciária — stub not_configured. */
  PREVIDENTIARY_DOCUMENT_ANALYSIS: "PREVIDENTIARY_DOCUMENT_ANALYSIS",
} as const;

export type KnownAiJobType = (typeof AI_JOB_TYPES)[keyof typeof AI_JOB_TYPES];

export type AiJobRecord = typeof aiJobs.$inferSelect;
export type AiJobHandler = (job: AiJobRecord) => Promise<void>;

export type RunOnceResult = {
  claimed: number;
  succeeded: number;
  failed: number;
  requeued: number;
  notConfigured: number;
};

const NO_HANDLER_CODE = "AI_JOB_HANDLER_NOT_REGISTERED";

export class LocalInProcessAiJobExecutor {
  readonly runtime = LOCAL_IN_PROCESS_RUNTIME;

  constructor(
    private readonly db: AppDatabase,
    private readonly handlers: Readonly<Record<string, AiJobHandler>> = {},
  ) {}

  /** Reivindica atomicamente (queued → running); outro executor que perca a corrida ignora o job. */
  private async claim(job: AiJobRecord): Promise<AiJobRecord | null> {
    const [row] = await this.db
      .update(aiJobs)
      .set({
        status: "running",
        attempts: sql`${aiJobs.attempts} + 1`,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(aiJobs.id, job.id), eq(aiJobs.status, "queued")))
      .returning();
    return row ?? null;
  }

  async runOnce(limit = 10): Promise<RunOnceResult> {
    const result: RunOnceResult = {
      claimed: 0,
      succeeded: 0,
      failed: 0,
      requeued: 0,
      notConfigured: 0,
    };
    const candidates = await this.db.query.aiJobs.findMany({
      where: and(eq(aiJobs.status, "queued"), eq(aiJobs.runtime, LOCAL_IN_PROCESS_RUNTIME)),
      orderBy: [asc(aiJobs.createdAt)],
      limit,
    });
    for (const candidate of candidates) {
      const job = await this.claim(candidate);
      if (!job) continue;
      result.claimed += 1;
      const handler = this.handlers[job.jobType];
      if (!handler) {
        await this.db
          .update(aiJobs)
          .set({
            status: "not_configured",
            failedAt: new Date(),
            lastErrorCode: NO_HANDLER_CODE,
            updatedAt: new Date(),
          })
          .where(eq(aiJobs.id, job.id));
        result.notConfigured += 1;
        continue;
      }
      try {
        await handler(job);
        await this.db
          .update(aiJobs)
          .set({
            status: "succeeded",
            progress: 100,
            completedAt: new Date(),
            lastErrorCode: null,
            updatedAt: new Date(),
          })
          .where(eq(aiJobs.id, job.id));
        result.succeeded += 1;
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code;
        const lastErrorCode = typeof code === "string" ? code.slice(0, 80) : "AI_JOB_FAILED";
        const retry = job.attempts < job.maxAttempts;
        await this.db
          .update(aiJobs)
          .set({
            status: retry ? "queued" : "failed",
            failedAt: retry ? null : new Date(),
            lastErrorCode,
            updatedAt: new Date(),
          })
          .where(eq(aiJobs.id, job.id));
        if (retry) result.requeued += 1;
        else result.failed += 1;
      }
    }
    return result;
  }
}
