import { auditEvents, type DatabaseExecutor } from "@verasjuris/database";
import { redactSensitive } from "@verasjuris/security";

export type AuditSource = "api" | "worker" | "system";

export type AuditRecord = {
  actorUserId?: string | null;
  organizationId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  source: AuditSource;
  requestId?: string | null;
  ip?: string | null;
  metadata?: Record<string, unknown> | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  const redacted = redactSensitive(value);
  if (!redacted || typeof redacted !== "object" || Array.isArray(redacted)) return null;
  return redacted as Record<string, unknown>;
}

export async function recordAudit(db: DatabaseExecutor, record: AuditRecord): Promise<void> {
  await db.insert(auditEvents).values({
    actorUserId: record.actorUserId ?? null,
    organizationId: record.organizationId ?? null,
    action: record.action,
    resourceType: record.resourceType,
    resourceId: record.resourceId ?? null,
    source: record.source,
    requestId: record.requestId ?? null,
    ip: record.ip ?? null,
    metadata: asRecord(record.metadata),
    before: asRecord(record.before),
    after: asRecord(record.after),
  });
}
