import type { JobQueue } from "@verasjuris/events";
import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import {
  communicationConsents,
  dataAssets,
  dataProcessors,
  dataRetentionPolicies,
  legalBases,
  privacyIncidentAssessments,
  privacyOfficers,
  processingActivities,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { desc, eq } from "drizzle-orm";
import { requireOrganizationPermission } from "../auth/routes.js";
import type { RequestMeta } from "../auth/service.js";

export class PrivacyGovernanceService {
  constructor(
    private readonly db: AppDatabase,
    private readonly jobQueue?: JobQueue | null,
  ) {}

  async listConsents(account: SessionAccount, organizationId: string) {
    requireOrganizationPermission(account, organizationId, "privacy.read");
    const items = await this.db.query.communicationConsents.findMany({
      where: eq(communicationConsents.organizationId, organizationId),
      orderBy: [desc(communicationConsents.createdAt)],
      limit: 200,
    });
    return { items };
  }

  async recordConsent(
    account: SessionAccount,
    organizationId: string,
    input: {
      subjectKey: string;
      purpose: string;
      legalBasis: string;
      granted: boolean;
      categories?: string[];
      evidenceReference?: string;
    },
    meta: RequestMeta,
  ) {
    requireOrganizationPermission(account, organizationId, "privacy.consent.manage");
    const [row] = await this.db
      .insert(communicationConsents)
      .values({
        organizationId,
        subjectType: "external",
        subjectId: account.user.id,
        channel: "email",
        category: "transactional",
        status: input.granted ? "opted_in" : "opted_out",
        source: "privacy_registry",
        grantedAt: input.granted ? new Date() : null,
        revokedAt: input.granted ? null : new Date(),
        evidence:
          input.evidenceReference ??
          `purpose:${input.purpose};basis:${input.legalBasis};subject:${input.subjectKey};req:${meta.requestId}`,
      })
      .returning();
    return { consent: row };
  }

  async createLegalBasis(
    account: SessionAccount,
    organizationId: string,
    input: { key: string; type: string; name: string; description?: string },
  ) {
    requireOrganizationPermission(account, organizationId, "privacy.manage");
    const allowed = [
      "consent",
      "contract",
      "legal_obligation",
      "regulatory",
      "legitimate_interest",
      "legal_process",
      "credit_protection",
      "health",
      "other",
    ] as const;
    const type = allowed.includes(input.type as (typeof allowed)[number])
      ? (input.type as (typeof allowed)[number])
      : "other";
    const [row] = await this.db
      .insert(legalBases)
      .values({
        organizationId,
        key: input.key,
        type,
        name: input.name,
        description: input.description ?? null,
      })
      .returning();
    return { legalBasis: row };
  }

  async listLegalBases(account: SessionAccount, organizationId: string) {
    requireOrganizationPermission(account, organizationId, "privacy.read");
    return {
      items: await this.db.query.legalBases.findMany({
        where: eq(legalBases.organizationId, organizationId),
      }),
    };
  }

  async createDataAsset(
    account: SessionAccount,
    organizationId: string,
    input: {
      systemDomain: string;
      dataCategory: string;
      purpose: string;
      sensitive?: boolean;
      legalBasisId?: string;
      retentionPolicyId?: string;
    },
  ) {
    requireOrganizationPermission(account, organizationId, "privacy.manage");
    const [row] = await this.db
      .insert(dataAssets)
      .values({
        organizationId,
        systemDomain: input.systemDomain,
        dataCategory: input.dataCategory,
        purpose: input.purpose,
        sensitive: input.sensitive ?? false,
        legalBasisId: input.legalBasisId ?? null,
        retentionPolicyId: input.retentionPolicyId ?? null,
        status: "active",
      })
      .returning();
    return { asset: row };
  }

  async createRetentionPolicy(
    account: SessionAccount,
    organizationId: string,
    input: {
      dataCategory: string;
      retentionDays: number;
      action: "delete" | "anonymize" | "archive" | "review";
      legalHoldExempt?: boolean;
    },
  ) {
    requireOrganizationPermission(account, organizationId, "privacy.manage");
    const disposal =
      input.action === "delete"
        ? "delete"
        : input.action === "anonymize"
          ? "anonymize"
          : input.action === "archive"
            ? "archive"
            : "manual_review";
    const [row] = await this.db
      .insert(dataRetentionPolicies)
      .values({
        organizationId,
        key: `${input.dataCategory}:${input.retentionDays}`,
        name: `Retenção ${input.dataCategory}`,
        dataType: input.dataCategory,
        durationDays: String(input.retentionDays),
        disposalMethod: disposal,
        legalHoldOverride: !(input.legalHoldExempt ?? false),
      })
      .returning();

    if (this.jobQueue && this.jobQueue.status !== "not_configured") {
      await this.jobQueue.enqueue(
        "RETENTION_REVIEW",
        { organizationId, policyId: row!.id },
        { idempotencyKey: `retention:${row!.id}` },
      );
    }
    return { policy: row };
  }

  async enqueueRetentionJobs(account: SessionAccount, organizationId: string) {
    requireOrganizationPermission(account, organizationId, "privacy.admin");
    if (!this.jobQueue || this.jobQueue.status === "not_configured") {
      return { enqueued: [], status: "not_configured" as const };
    }
    const jobs = [
      "RETENTION_REVIEW",
      "RETENTION_EXPIRE",
      "RETENTION_ANONYMIZE",
      "CONSENT_EXPIRATION",
    ] as const;
    const enqueued = [];
    for (const type of jobs) {
      const job = await this.jobQueue.enqueue(
        type,
        { organizationId },
        { idempotencyKey: `${type}:${organizationId}:${Date.now()}` },
      );
      enqueued.push({ type, id: job.id });
    }
    return { enqueued, status: "queued" as const };
  }

  async createProcessingActivity(
    account: SessionAccount,
    organizationId: string,
    input: {
      key: string;
      name: string;
      purpose: string;
      dataSubjects?: string[];
      dataCategories?: string[];
    },
  ) {
    requireOrganizationPermission(account, organizationId, "privacy.manage");
    const [row] = await this.db
      .insert(processingActivities)
      .values({
        organizationId,
        key: input.key,
        name: input.name,
        purpose: input.purpose,
        dataSubjects: input.dataSubjects ?? [],
        dataCategories: input.dataCategories ?? [],
      })
      .returning();
    return { activity: row };
  }

  async upsertDpo(
    account: SessionAccount,
    organizationId: string,
    input: {
      displayName: string;
      email: string;
      phone?: string;
      role?: "dpo" | "deputy_dpo" | "privacy_contact" | "other";
    },
  ) {
    requireOrganizationPermission(account, organizationId, "privacy.dpo");
    const [row] = await this.db
      .insert(privacyOfficers)
      .values({
        organizationId,
        userId: account.user.id,
        role: input.role ?? "dpo",
        displayName: input.displayName,
        email: input.email,
        phone: input.phone ?? null,
      })
      .returning();
    return { officer: row };
  }

  async createProcessor(
    account: SessionAccount,
    organizationId: string,
    input: { name: string; role: string; contactEmail?: string; dpaReference?: string },
  ) {
    requireOrganizationPermission(account, organizationId, "privacy.manage");
    const [row] = await this.db
      .insert(dataProcessors)
      .values({
        organizationId,
        vendorName: input.name,
        purpose: input.role,
        dpaDocumentRef: input.dpaReference ?? null,
        metadata: { contactEmail: input.contactEmail ?? null },
      })
      .returning();
    return { processor: row };
  }

  async createIncidentAssessment(
    account: SessionAccount,
    organizationId: string,
    input: {
      title: string;
      description: string;
      discoveredAt: string;
      severity: string;
      affectedSystems?: string[];
    },
  ) {
    requireOrganizationPermission(account, organizationId, "privacy.incident.manage");
    const [row] = await this.db
      .insert(privacyIncidentAssessments)
      .values({
        organizationId,
        title: input.title,
        status: "draft",
        riskLevel: input.severity,
        assessment: {
          description: input.description,
          discoveredAt: input.discoveredAt,
          affectedSystems: input.affectedSystems ?? [],
        },
      })
      .returning();
    return { assessment: row };
  }

  async listIncidents(account: SessionAccount, organizationId: string) {
    requireOrganizationPermission(account, organizationId, "privacy.read");
    return {
      items: await this.db.query.privacyIncidentAssessments.findMany({
        where: eq(privacyIncidentAssessments.organizationId, organizationId),
        orderBy: [desc(privacyIncidentAssessments.createdAt)],
      }),
    };
  }
}
