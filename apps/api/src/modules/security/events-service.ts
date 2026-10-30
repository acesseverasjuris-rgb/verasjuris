import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import {
  securityAlerts,
  securityEvents,
  securityPentests,
  securityVulnerabilities,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import { requireOrganizationPermission } from "../auth/routes.js";

const EVENT_TYPE_MAP: Record<
  string,
  | "login_failure"
  | "mfa_failure"
  | "session_anomaly"
  | "privilege_change"
  | "secret_failure"
  | "rate_limit"
  | "suspicious_upload"
  | "webhook_invalid"
  | "payment_anomaly"
  | "api_abuse"
  | "other"
> = {
  login_failure: "login_failure",
  mfa_failure: "mfa_failure",
  session_anomaly: "session_anomaly",
  privilege_escalation_attempt: "privilege_change",
  privilege_change: "privilege_change",
  api_abuse: "api_abuse",
  webhook_signature_failure: "webhook_invalid",
  webhook_invalid: "webhook_invalid",
  other: "other",
};

const ALERT_STATUS_MAP: Record<
  string,
  "open" | "acknowledged" | "investigating" | "resolved" | "dismissed"
> = {
  open: "open",
  acknowledged: "acknowledged",
  resolved: "resolved",
  dismissed: "dismissed",
  investigating: "investigating",
};

const VULN_STATUS_MAP: Record<
  string,
  "open" | "triaged" | "in_remediation" | "fixed" | "accepted" | "false_positive"
> = {
  open: "open",
  triaged: "triaged",
  mitigated: "in_remediation",
  in_remediation: "in_remediation",
  fixed: "fixed",
  accepted_risk: "accepted",
  accepted: "accepted",
  false_positive: "false_positive",
};

const PENTEST_STATUS_MAP: Record<
  string,
  "planned" | "in_progress" | "completed" | "report_pending" | "approved" | "rejected" | "cancelled"
> = {
  planned: "planned",
  in_progress: "in_progress",
  report_received: "report_pending",
  remediating: "in_progress",
  closed: "completed",
  completed: "completed",
  report_pending: "report_pending",
  approved: "approved",
  rejected: "rejected",
  cancelled: "cancelled",
};

export class SecurityOpsService {
  constructor(private readonly db: AppDatabase) {}

  async listEvents(
    account: SessionAccount,
    organizationId: string,
    opts: { limit: number; offset: number; type?: string },
  ) {
    requireOrganizationPermission(account, organizationId, "security.events.read");
    const type = opts.type ? EVENT_TYPE_MAP[opts.type] : undefined;
    const items = await this.db.query.securityEvents.findMany({
      where: type
        ? and(eq(securityEvents.organizationId, organizationId), eq(securityEvents.type, type))
        : eq(securityEvents.organizationId, organizationId),
      orderBy: [desc(securityEvents.createdAt)],
      limit: opts.limit,
      offset: opts.offset,
    });
    return { items };
  }

  async createAlert(
    account: SessionAccount,
    organizationId: string,
    input: {
      title: string;
      body: string;
      severity: "info" | "low" | "medium" | "high" | "critical";
      eventType?: string;
    },
  ) {
    requireOrganizationPermission(account, organizationId, "security.alert.manage");
    const eventType = EVENT_TYPE_MAP[input.eventType ?? "other"] ?? "other";
    const [event] = await this.db
      .insert(securityEvents)
      .values({
        type: eventType,
        severity: input.severity,
        organizationId,
        userId: account.user.id,
        metadata: { body: input.body },
      })
      .returning();
    const [alert] = await this.db
      .insert(securityAlerts)
      .values({
        title: input.title,
        severity: input.severity,
        organizationId,
        eventId: event!.id,
        status: "open",
      })
      .returning();
    return { alert, event };
  }

  async updateAlert(
    account: SessionAccount,
    organizationId: string,
    alertId: string,
    status: string,
  ) {
    requireOrganizationPermission(account, organizationId, "security.alert.manage");
    const mapped = ALERT_STATUS_MAP[status];
    if (!mapped) throw new AppError("VALIDATION_ERROR", "Status de alerta inválido.");
    const existing = await this.db.query.securityAlerts.findFirst({
      where: and(eq(securityAlerts.id, alertId), eq(securityAlerts.organizationId, organizationId)),
    });
    if (!existing) throw new AppError("NOT_FOUND", "Alerta não encontrado.");
    const [alert] = await this.db
      .update(securityAlerts)
      .set({
        status: mapped,
        acknowledgedAt: mapped === "acknowledged" ? new Date() : existing.acknowledgedAt,
        resolvedAt:
          mapped === "resolved" || mapped === "dismissed" ? new Date() : existing.resolvedAt,
        updatedAt: new Date(),
      })
      .where(eq(securityAlerts.id, alertId))
      .returning();
    return { alert };
  }

  async listAlerts(account: SessionAccount, organizationId: string) {
    requireOrganizationPermission(account, organizationId, "security.read");
    const items = await this.db.query.securityAlerts.findMany({
      where: eq(securityAlerts.organizationId, organizationId),
      orderBy: [desc(securityAlerts.createdAt)],
      limit: 100,
    });
    return { items };
  }

  async createVulnerability(
    account: SessionAccount,
    organizationId: string,
    input: {
      source: string;
      identifier: string;
      component?: string;
      severity: "info" | "low" | "medium" | "high" | "critical";
      summary: string;
    },
  ) {
    requireOrganizationPermission(account, organizationId, "security.admin");
    void organizationId;
    const [row] = await this.db
      .insert(securityVulnerabilities)
      .values({
        source: input.source,
        identifier: input.identifier,
        packageName: input.component ?? null,
        severity: input.severity,
        status: "open",
        metadata: { summary: input.summary, organizationId },
      })
      .returning();
    return { vulnerability: row };
  }

  async updateVulnerability(account: SessionAccount, vulnerabilityId: string, status: string) {
    requireOrganizationPermission(
      account,
      account.memberships[0]?.organizationId ?? "",
      "security.admin",
    );
    const mapped = VULN_STATUS_MAP[status];
    if (!mapped) throw new AppError("VALIDATION_ERROR", "Status de vulnerabilidade inválido.");
    const [row] = await this.db
      .update(securityVulnerabilities)
      .set({
        status: mapped,
        fixedAt: mapped === "fixed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(securityVulnerabilities.id, vulnerabilityId))
      .returning();
    if (!row) throw new AppError("NOT_FOUND", "Vulnerabilidade não encontrada.");
    return { vulnerability: row };
  }

  async listVulnerabilities(account: SessionAccount) {
    requireOrganizationPermission(
      account,
      account.memberships[0]?.organizationId ?? "",
      "security.read",
    );
    const items = await this.db.query.securityVulnerabilities.findMany({
      orderBy: [desc(securityVulnerabilities.detectedAt)],
      limit: 100,
    });
    return { items };
  }

  async createPentest(
    account: SessionAccount,
    organizationId: string,
    input: { vendor: string; startedAt?: string; scope?: string },
  ) {
    requireOrganizationPermission(account, organizationId, "security.admin");
    const [row] = await this.db
      .insert(securityPentests)
      .values({
        title: input.vendor,
        organizationId,
        status: "planned",
        conductedAt: input.startedAt ? new Date(input.startedAt) : null,
        notes: input.scope ?? null,
      })
      .returning();
    return { pentest: row };
  }

  async updatePentest(
    account: SessionAccount,
    organizationId: string,
    pentestId: string,
    input: { status: string; reportReference?: string },
  ) {
    requireOrganizationPermission(account, organizationId, "security.admin");
    const mapped = PENTEST_STATUS_MAP[input.status];
    if (!mapped) throw new AppError("VALIDATION_ERROR", "Status de pentest inválido.");
    if (mapped === "approved") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Pentest não pode ser auto-aprovado sem relatório real revisado.",
      );
    }
    const existing = await this.db.query.securityPentests.findFirst({
      where: and(
        eq(securityPentests.id, pentestId),
        eq(securityPentests.organizationId, organizationId),
      ),
    });
    if (!existing) throw new AppError("NOT_FOUND", "Pentest não encontrado.");
    const [row] = await this.db
      .update(securityPentests)
      .set({
        status: mapped,
        notes: input.reportReference
          ? `${existing.notes ?? ""}\nreport:${input.reportReference}`.trim()
          : existing.notes,
        updatedAt: new Date(),
      })
      .where(eq(securityPentests.id, pentestId))
      .returning();
    return { pentest: row };
  }

  async listPentests(account: SessionAccount, organizationId: string) {
    requireOrganizationPermission(account, organizationId, "security.read");
    const items = await this.db.query.securityPentests.findMany({
      where: eq(securityPentests.organizationId, organizationId),
      orderBy: [desc(securityPentests.createdAt)],
    });
    return { items };
  }
}
