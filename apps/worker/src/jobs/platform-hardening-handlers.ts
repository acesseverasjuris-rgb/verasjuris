import type { AppDatabase } from "@verasjuris/database";
import type { JobHandler, JobRecord, LocalInProcessQueueProvider } from "@verasjuris/events";

/** Prompt 222 — Integration jobs */
export const JOB_PROVIDER_HEALTH_CHECK = "PROVIDER_HEALTH_CHECK" as const;
export const JOB_COURT_SYNC = "COURT_SYNC" as const;
export const JOB_ADMIN_AGENCY_SYNC = "ADMIN_AGENCY_SYNC" as const;
export const JOB_CALENDAR_SYNC = "CALENDAR_SYNC" as const;
export const JOB_CRM_SYNC = "CRM_SYNC" as const;
export const JOB_ERP_SYNC = "ERP_SYNC" as const;

/** Prompt 223 — Security jobs */
export const JOB_SESSION_CLEANUP = "SESSION_CLEANUP" as const;
export const JOB_VULNERABILITY_REFRESH = "VULNERABILITY_REFRESH" as const;
export const JOB_SECURITY_ALERT_PROCESS = "SECURITY_ALERT_PROCESS" as const;

/** Prompt 224 — Privacy jobs */
export const JOB_RETENTION_REVIEW = "RETENTION_REVIEW" as const;
export const JOB_RETENTION_EXPIRE = "RETENTION_EXPIRE" as const;
export const JOB_RETENTION_ANONYMIZE = "RETENTION_ANONYMIZE" as const;
export const JOB_DSR_PROCESS = "DSR_PROCESS" as const;
export const JOB_ANONYMIZATION = "ANONYMIZATION" as const;
export const JOB_CONSENT_EXPIRATION = "CONSENT_EXPIRATION" as const;

/** Prompt 225 — Observability jobs */
export const JOB_SLO_REFRESH = "SLO_REFRESH" as const;
export const JOB_UPTIME_CHECK = "UPTIME_CHECK" as const;
export const JOB_BACKUP_VERIFY = "BACKUP_VERIFY" as const;

/** Prompt 226 — Enterprise jobs */
export const JOB_SCIM_SYNC = "SCIM_SYNC" as const;
export const JOB_CUSTOM_DOMAIN_VERIFY = "CUSTOM_DOMAIN_VERIFY" as const;
export const JOB_SLA_REFRESH = "SLA_REFRESH" as const;

/** Prompt 227 — Translation jobs */
export const JOB_AUTO_TRANSLATE_CONTENT = "AUTO_TRANSLATE_CONTENT" as const;

/** Prompt 228 — Assistant jobs */
export const JOB_ASSISTANT_ASYNC_INDEX = "ASSISTANT_ASYNC_INDEX" as const;
export const JOB_ASSISTANT_FEEDBACK_AGGREGATE = "ASSISTANT_FEEDBACK_AGGREGATE" as const;

type OrgPayload = {
  organizationId?: string;
  dsrId?: string;
  policyId?: string;
  sourceId?: string;
};

function requireOrganizationId(job: JobRecord): string {
  const payload = job.payload as OrgPayload | null;
  const organizationId = payload?.organizationId?.trim();
  if (!organizationId) {
    throw Object.assign(new Error(`${job.type} exige organizationId`), {
      code: "VALIDATION_ERROR",
    });
  }
  return organizationId;
}

function createIdempotentStub(name: string): JobHandler {
  return async (job: JobRecord) => {
    requireOrganizationId(job);
    void name;
  };
}

export function registerLocalPlatformHardeningHandlers(
  queue: LocalInProcessQueueProvider,
  db: AppDatabase,
): void {
  void db;

  const stubs: Array<[string, string]> = [
    [JOB_PROVIDER_HEALTH_CHECK, "provider_health"],
    [JOB_COURT_SYNC, "court_sync"],
    [JOB_ADMIN_AGENCY_SYNC, "admin_agency_sync"],
    [JOB_CALENDAR_SYNC, "calendar_sync"],
    [JOB_CRM_SYNC, "crm_sync"],
    [JOB_ERP_SYNC, "erp_sync"],
    [JOB_SESSION_CLEANUP, "session_cleanup"],
    [JOB_VULNERABILITY_REFRESH, "vulnerability_refresh"],
    [JOB_SECURITY_ALERT_PROCESS, "security_alert_process"],
    [JOB_RETENTION_REVIEW, "retention_review"],
    [JOB_RETENTION_EXPIRE, "retention_expire"],
    [JOB_RETENTION_ANONYMIZE, "retention_anonymize"],
    [JOB_DSR_PROCESS, "dsr_process"],
    [JOB_ANONYMIZATION, "anonymization"],
    [JOB_CONSENT_EXPIRATION, "consent_expiration"],
    [JOB_SLO_REFRESH, "slo_refresh"],
    [JOB_UPTIME_CHECK, "uptime_check"],
    [JOB_BACKUP_VERIFY, "backup_verify"],
    [JOB_SCIM_SYNC, "scim_sync"],
    [JOB_CUSTOM_DOMAIN_VERIFY, "custom_domain_verify"],
    [JOB_SLA_REFRESH, "sla_refresh"],
    [JOB_AUTO_TRANSLATE_CONTENT, "auto_translate"],
    [JOB_ASSISTANT_ASYNC_INDEX, "assistant_index"],
    [JOB_ASSISTANT_FEEDBACK_AGGREGATE, "assistant_feedback"],
  ];

  for (const [type, name] of stubs) {
    queue.registerHandler(type, createIdempotentStub(name));
  }
}
