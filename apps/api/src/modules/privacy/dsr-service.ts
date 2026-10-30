import type { JobQueue } from "@verasjuris/events";
import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { crmClients, dataSubjectRequests, documents, profiles, users } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, eq } from "drizzle-orm";
import { requireOrganizationPermission } from "../auth/routes.js";
import type { RequestMeta } from "../auth/service.js";

const TYPE_MAP = {
  access: "access",
  correction: "correction",
  deletion: "deletion",
  portability: "portability",
  anonymization: "anonymization",
  opposition: "objection",
  information: "access",
  restriction: "restriction",
  objection: "objection",
  consent_withdrawal: "consent_withdrawal",
} as const;

const STATUS_MAP = {
  received: "received",
  identity_pending: "identity_pending",
  in_progress: "in_progress",
  under_review: "under_review",
  completed: "completed",
  partially_completed: "partially_completed",
  rejected: "rejected",
  cancelled: "cancelled",
} as const;

export class DsrService {
  constructor(
    private readonly db: AppDatabase,
    private readonly jobQueue?: JobQueue | null,
  ) {}

  async create(
    account: SessionAccount,
    organizationId: string,
    input: { subjectKey: string; type: keyof typeof TYPE_MAP; channel?: string; notes?: string },
    meta: RequestMeta,
  ) {
    requireOrganizationPermission(account, organizationId, "privacy.dsr.manage");
    const type = TYPE_MAP[input.type];
    if (!type) throw new AppError("VALIDATION_ERROR", "Tipo de DSR inválido.");
    const [row] = await this.db
      .insert(dataSubjectRequests)
      .values({
        organizationId,
        type,
        status: "received",
        subjectExternalRef: input.subjectKey,
        requestedByUserId: account.user.id,
        notes: input.notes ?? null,
        metadata: { channel: input.channel ?? null, requestId: meta.requestId },
      })
      .returning();

    if (this.jobQueue && this.jobQueue.status !== "not_configured") {
      await this.jobQueue.enqueue(
        "DSR_PROCESS",
        { organizationId, dsrId: row!.id },
        { idempotencyKey: `dsr:${row!.id}` },
      );
    }
    return { request: this.toPublic(row!) };
  }

  async list(account: SessionAccount, organizationId: string) {
    requireOrganizationPermission(account, organizationId, "privacy.read");
    const items = await this.db.query.dataSubjectRequests.findMany({
      where: eq(dataSubjectRequests.organizationId, organizationId),
    });
    return { items: items.map((row) => this.toPublic(row)) };
  }

  async get(account: SessionAccount, organizationId: string, dsrId: string) {
    requireOrganizationPermission(account, organizationId, "privacy.read");
    const row = await this.requireOrgDsr(organizationId, dsrId);
    return { request: this.toPublic(row) };
  }

  async updateStatus(
    account: SessionAccount,
    organizationId: string,
    dsrId: string,
    input: { status: keyof typeof STATUS_MAP; notes?: string },
  ) {
    requireOrganizationPermission(account, organizationId, "privacy.dsr.manage");
    const row = await this.requireOrgDsr(organizationId, dsrId);
    const status = STATUS_MAP[input.status];
    if (!status) throw new AppError("VALIDATION_ERROR", "Status de DSR inválido.");

    if (status === "completed" && (row.type === "deletion" || row.type === "anonymization")) {
      await this.assertNoLegalHold(organizationId, row.subjectExternalRef);
    }

    const [updated] = await this.db
      .update(dataSubjectRequests)
      .set({
        status,
        notes: input.notes ?? row.notes,
        completedAt: status === "completed" ? new Date() : row.completedAt,
        updatedAt: new Date(),
      })
      .where(eq(dataSubjectRequests.id, dsrId))
      .returning();
    return { request: this.toPublic(updated!) };
  }

  async exportPortability(account: SessionAccount, organizationId: string, dsrId: string) {
    requireOrganizationPermission(account, organizationId, "privacy.dsr.manage");
    const row = await this.requireOrgDsr(organizationId, dsrId);
    if (row.type !== "portability" && row.type !== "access") {
      throw new AppError(
        "VALIDATION_ERROR",
        "Exportação disponível apenas para access/portability.",
      );
    }
    const subjectKey = row.subjectExternalRef ?? "";
    // Isolation: only this organization.
    const orgClients = await this.db.query.crmClients.findMany({
      where: eq(crmClients.organizationId, organizationId),
      limit: 200,
    });
    const matchedClients = orgClients.filter(
      (c) =>
        c.id === subjectKey ||
        c.email?.toLowerCase() === subjectKey.toLowerCase() ||
        c.cpfNormalized === subjectKey ||
        c.cnpjNormalized === subjectKey,
    );
    const user = subjectKey.includes("@")
      ? await this.db.query.users.findFirst({ where: eq(users.email, subjectKey.toLowerCase()) })
      : null;
    const profile = user
      ? await this.db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) })
      : null;

    const payload = {
      organizationId,
      dsrId: row.id,
      type: row.type,
      exportedAt: new Date().toISOString(),
      subject: {
        externalRef: row.subjectExternalRef,
        user: user
          ? {
              id: user.id,
              email: user.email,
              displayName: profile?.displayName ?? null,
              locale: profile?.locale ?? null,
            }
          : null,
        clients: matchedClients.map((c) => ({
          id: c.id,
          name: c.fullName ?? c.legalName,
          email: c.email,
          documentNumber: c.cpfNormalized ?? c.cnpjNormalized,
        })),
      },
    };
    return { export: payload };
  }

  async processDeletion(account: SessionAccount, organizationId: string, dsrId: string) {
    requireOrganizationPermission(account, organizationId, "privacy.dsr.manage");
    const row = await this.requireOrgDsr(organizationId, dsrId);
    if (row.type !== "deletion") {
      throw new AppError("VALIDATION_ERROR", "Processamento de exclusão exige tipo deletion.");
    }
    await this.assertNoLegalHold(organizationId, row.subjectExternalRef);
    if (this.jobQueue && this.jobQueue.status !== "not_configured") {
      await this.jobQueue.enqueue(
        "ANONYMIZATION",
        { organizationId, dsrId, mode: "delete" },
        { idempotencyKey: `anon-del:${dsrId}` },
      );
    }
    const [updated] = await this.db
      .update(dataSubjectRequests)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(dataSubjectRequests.id, dsrId))
      .returning();
    return { request: this.toPublic(updated!), enqueued: true };
  }

  private async assertNoLegalHold(organizationId: string, subjectRef: string | null) {
    const held = await this.db.query.documents.findMany({
      where: and(eq(documents.organizationId, organizationId), eq(documents.legalHold, true)),
      limit: 50,
    });
    if (held.length > 0) {
      throw new AppError(
        "CONFLICT",
        "Exclusão bloqueada por legal hold em documentos desta organização.",
      );
    }
    void subjectRef;
  }

  private async requireOrgDsr(organizationId: string, dsrId: string) {
    const row = await this.db.query.dataSubjectRequests.findFirst({
      where: and(
        eq(dataSubjectRequests.id, dsrId),
        eq(dataSubjectRequests.organizationId, organizationId),
      ),
    });
    if (!row) throw new AppError("NOT_FOUND", "Solicitação DSR não encontrada nesta organização.");
    return row;
  }

  private toPublic(row: typeof dataSubjectRequests.$inferSelect) {
    return {
      id: row.id,
      organizationId: row.organizationId,
      type: row.type,
      status: row.status,
      subjectExternalRef: row.subjectExternalRef,
      notes: row.notes,
      completedAt: row.completedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
