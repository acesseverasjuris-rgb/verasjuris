import type { SessionAccount } from "@verasjuris/auth";
import { policyIntegrationCredential } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { integrationCredentials } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import type { RequestMeta } from "../auth/service.js";
import { requireOrganizationPermission } from "../auth/routes.js";

function authorize(
  account: SessionAccount,
  organizationId: string,
  permission: "integration.read" | "integration.credential.manage",
) {
  requireOrganizationPermission(account, organizationId, permission);
  const membership = account.memberships.find((m) => m.organizationId === organizationId)!;
  const decision = policyIntegrationCredential(
    {
      status: membership.membershipStatus,
      organizationStatus: membership.organizationStatus,
      permissions: membership.permissions,
      roles: membership.roles,
    },
    permission === "integration.read" ? "integration.read" : "integration.credential.manage",
  );
  if (!decision.ok) throw new AppError(decision.code, decision.message);
}

export class IntegrationCredentialsService {
  constructor(private readonly db: AppDatabase) {}

  async list(account: SessionAccount, organizationId: string) {
    authorize(account, organizationId, "integration.read");
    const items = await this.db.query.integrationCredentials.findMany({
      where: eq(integrationCredentials.organizationId, organizationId),
      orderBy: [desc(integrationCredentials.createdAt)],
    });
    return {
      items: items.map((row) => ({
        id: row.id,
        providerKey: row.providerKey,
        credentialReference: row.credentialReference,
        environment: row.environment,
        status: row.status,
        rotatedAt: row.rotatedAt?.toISOString() ?? null,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async create(
    account: SessionAccount,
    organizationId: string,
    input: {
      providerKey: string;
      credentialReference: string;
      environment?: "development" | "staging" | "production" | "sandbox";
      expiresAt?: string;
    },
    _meta: RequestMeta,
  ) {
    authorize(account, organizationId, "integration.credential.manage");
    const env =
      input.environment === "development" ||
      input.environment === "staging" ||
      input.environment === "sandbox" ||
      input.environment === "production"
        ? input.environment
        : "production";
    const [row] = await this.db
      .insert(integrationCredentials)
      .values({
        organizationId,
        providerKey: input.providerKey,
        credentialReference: input.credentialReference,
        environment: env,
        status: "configured",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      })
      .returning();
    return {
      credential: {
        id: row!.id,
        providerKey: row!.providerKey,
        credentialReference: row!.credentialReference,
        environment: row!.environment,
        status: row!.status,
      },
    };
  }

  async rotate(
    account: SessionAccount,
    organizationId: string,
    credentialId: string,
    input: { credentialReference: string; expiresAt?: string },
  ) {
    authorize(account, organizationId, "integration.credential.manage");
    const existing = await this.db.query.integrationCredentials.findFirst({
      where: and(
        eq(integrationCredentials.id, credentialId),
        eq(integrationCredentials.organizationId, organizationId),
      ),
    });
    if (!existing) throw new AppError("NOT_FOUND", "Credencial de integração não encontrada.");
    const [row] = await this.db
      .update(integrationCredentials)
      .set({
        credentialReference: input.credentialReference,
        rotatedAt: new Date(),
        status: "rotated",
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : existing.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(integrationCredentials.id, credentialId))
      .returning();
    return {
      credential: {
        id: row!.id,
        credentialReference: row!.credentialReference,
        status: row!.status,
        rotatedAt: row!.rotatedAt?.toISOString() ?? null,
      },
    };
  }

  async disable(account: SessionAccount, organizationId: string, credentialId: string) {
    authorize(account, organizationId, "integration.credential.manage");
    const existing = await this.db.query.integrationCredentials.findFirst({
      where: and(
        eq(integrationCredentials.id, credentialId),
        eq(integrationCredentials.organizationId, organizationId),
      ),
    });
    if (!existing) throw new AppError("NOT_FOUND", "Credencial de integração não encontrada.");
    await this.db
      .update(integrationCredentials)
      .set({ status: "disabled", updatedAt: new Date() })
      .where(eq(integrationCredentials.id, credentialId));
    return { disabled: true };
  }
}
