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
  /** Cálculo tributário assíncrono — stub not_configured (motor síncrono na API). */
  TAX_CALCULATION: "TAX_CALCULATION",
  /** Importação fiscal — stub not_configured. */
  TAX_IMPORT: "TAX_IMPORT",
  /** Sync provedores fiscais — stub not_configured. */
  TAX_PROVIDER_SYNC: "TAX_PROVIDER_SYNC",
  /** Alertas de contrato — stub not_configured. */
  CONTRACT_ALERT: "CONTRACT_ALERT",
  /** Alertas de renovação — stub not_configured. */
  CONTRACT_RENEWAL_ALERT: "CONTRACT_RENEWAL_ALERT",
  /** Sync status assinatura — stub not_configured. */
  SIGNATURE_STATUS_SYNC: "SIGNATURE_STATUS_SYNC",
  /** Revisão IA de contrato — stub not_configured. */
  CONTRACT_AI_REVIEW: "CONTRACT_AI_REVIEW",
  /** Análise documental por área — stub not_configured. */
  AREA_DOCUMENT_ANALYSIS: "AREA_DOCUMENT_ANALYSIS",
  /** Despacho outbox de comunicação — handler local no worker. */
  COMMUNICATION_DISPATCH: "COMMUNICATION_DISPATCH",
  /** Reprocessamento de falhas transitórias de comunicação. */
  COMMUNICATION_RETRY: "COMMUNICATION_RETRY",
  /** Geração assíncrona de candidatos de match — stub local. */
  ONLINE_MATCH_GENERATION: "ONLINE_MATCH_GENERATION",
  /** Expiração de ofertas de match — stub local. */
  ONLINE_MATCH_EXPIRATION: "ONLINE_MATCH_EXPIRATION",
  /** Lembrete de consulta agendada — stub local. */
  CONSULTATION_REMINDER: "CONSULTATION_REMINDER",
  /** Sync status pagamento externo — stub not_configured. */
  PAYMENT_STATUS_SYNC: "PAYMENT_STATUS_SYNC",
  /** Verificação OAB assíncrona — stub not_configured. */
  OAB_VERIFICATION: "OAB_VERIFICATION",
  /** Despacho push externo — stub not_configured. */
  PUSH_DISPATCH: "PUSH_DISPATCH",
  MARKETPLACE_REQUEST_EXPIRATION: "MARKETPLACE_REQUEST_EXPIRATION",
  MARKETPLACE_PROPOSAL_EXPIRATION: "MARKETPLACE_PROPOSAL_EXPIRATION",
  MARKETPLACE_DELIVERY_REMINDER: "MARKETPLACE_DELIVERY_REMINDER",
  PROFESSIONAL_REVALIDATION_CHECK: "PROFESSIONAL_REVALIDATION_CHECK",
  PROFESSIONAL_VERIFICATION_PROVIDER_SYNC: "PROFESSIONAL_VERIFICATION_PROVIDER_SYNC",
  DILIGENCE_DEADLINE_REMINDER: "DILIGENCE_DEADLINE_REMINDER",
  DILIGENCE_EVIDENCE_REVIEW_REMINDER: "DILIGENCE_EVIDENCE_REVIEW_REMINDER",
  EXTRAJUDICIAL_STATUS_SYNC: "EXTRAJUDICIAL_STATUS_SYNC",
  EXTRAJUDICIAL_REQUIREMENT_REMINDER: "EXTRAJUDICIAL_REQUIREMENT_REMINDER",
  REGISTRY_PROVIDER_SYNC: "REGISTRY_PROVIDER_SYNC",
  /** Liberação de módulo/aula — stub local. */
  COURSE_RELEASE: "COURSE_RELEASE",
  /** Expira matrículas com expiresAt passado. */
  COURSE_EXPIRATION: "COURSE_EXPIRATION",
  /** PDF de certificado — PDF_GENERATION_NOT_CONFIGURED (não inventa PDF). */
  CERTIFICATE_GENERATION: "CERTIFICATE_GENERATION",
  /** Lembrete de aprendizado — stub local. */
  LEARNING_REMINDER: "LEARNING_REMINDER",
  /** Job assistivo de IA educacional — stub local. */
  EDUCATION_AI_JOB: "EDUCATION_AI_JOB",
  /** Renovação de assinatura idempotente por periodKey. */
  SUBSCRIPTION_RENEWAL: "SUBSCRIPTION_RENEWAL",
  /** Geração de invoice idempotente. */
  INVOICE_GENERATION: "INVOICE_GENERATION",
  /** Lembrete de fatura a vencer — stub local. */
  INVOICE_DUE_REMINDER: "INVOICE_DUE_REMINDER",
  /** Marca invoices vencidas como past_due. */
  PAST_DUE_CHECK: "PAST_DUE_CHECK",
  /** Expira créditos available com expiresAt passado. */
  CREDIT_EXPIRATION: "CREDIT_EXPIRATION",
  /** Sync status de reembolso externo — stub not_configured. */
  REFUND_STATUS_SYNC: "REFUND_STATUS_SYNC",
  /** Processa webhooks pending sem inventar liquidação. */
  PAYMENT_WEBHOOK_PROCESS: "PAYMENT_WEBHOOK_PROCESS",
  /** Repasse/payout externo — stub not_configured. */
  PAYOUT_PROCESS: "PAYOUT_PROCESS",
  /** Conciliação bancária — stub not_configured. */
  RECONCILIATION_SYNC: "RECONCILIATION_SYNC",
  /** Alocação assíncrona de pagamento (split interno via API; job noop). */
  PAYMENT_ALLOCATION: "PAYMENT_ALLOCATION",
  /** Libera payables pending com availableAt passado. */
  PAYABLE_RELEASE: "PAYABLE_RELEASE",
  /** Agenda de repasse — stub local (não inventa payout pago). */
  PAYOUT_SCHEDULE: "PAYOUT_SCHEDULE",
  /** Sync status de payout externo — stub not_configured. */
  PAYOUT_STATUS_SYNC: "PAYOUT_STATUS_SYNC",
  /** Processa reembolso externo — stub not_configured. */
  REFUND_PROCESS: "REFUND_PROCESS",
  /** Sync status de disputa/chargeback — stub not_configured. */
  DISPUTE_STATUS_SYNC: "DISPUTE_STATUS_SYNC",
  /** Conciliação gateway × ledger — stub not_configured. */
  GATEWAY_RECONCILIATION: "GATEWAY_RECONCILIATION",
  /** Conciliação bancária — stub not_configured. */
  BANK_RECONCILIATION: "BANK_RECONCILIATION",
  /** Conciliação ledger interna — stub local. */
  LEDGER_RECONCILIATION: "LEDGER_RECONCILIATION",
  /** Importação de extrato/OFX/CNAB — stub not_configured. */
  RECONCILIATION_IMPORT: "RECONCILIATION_IMPORT",
  /** Sincroniza delinquency_cases a partir de receivables vencidos. */
  DELINQUENCY_CHECK: "DELINQUENCY_CHECK",
  /** Marca accounts_payable vencidos como overdue. */
  PAYABLE_DUE_CHECK: "PAYABLE_DUE_CHECK",
  /** Marca receivables vencidos como overdue. */
  RECEIVABLE_DUE_CHECK: "RECEIVABLE_DUE_CHECK",
  /** Refresh de forecast — stub local (sem inventar caixa). */
  FORECAST_REFRESH: "FORECAST_REFRESH",
  /** Agregação de usage meters — stub local. */
  USAGE_AGGREGATION: "USAGE_AGGREGATION",
  /** Expira AI credits com expiresAt declarado no grant. */
  AI_CREDIT_EXPIRATION: "AI_CREDIT_EXPIRATION",
  /** Faturamento de uso de API — stub local (exige invoice via API). */
  API_USAGE_BILLING: "API_USAGE_BILLING",
  /** Licenças active com endsAt passado → expired. */
  LICENSE_EXPIRATION: "LICENSE_EXPIRATION",
  /** Refresh de entitlements derivados — stub local. */
  PLAN_ENTITLEMENT_REFRESH: "PLAN_ENTITLEMENT_REFRESH",
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
