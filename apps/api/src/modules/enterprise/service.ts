import type { CustomDomainProvider, SCIMProvider, SSOProvider } from "@verasjuris/ai";
import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import {
  enterpriseSlas,
  enterpriseSsoConfigs,
  organizationSecurityPolicies,
  whiteLabelConfigs,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, eq } from "drizzle-orm";
import { requireOrganizationPermission } from "../auth/routes.js";

export class EnterpriseService {
  constructor(
    private readonly db: AppDatabase,
    private readonly sso: SSOProvider,
    private readonly scim: SCIMProvider,
    private readonly customDomain: CustomDomainProvider,
  ) {}

  async getOrCreateSso(
    account: SessionAccount,
    organizationId: string,
    input: {
      protocol: "saml" | "oidc";
      issuer: string;
      metadataUrl?: string;
      clientId?: string;
      clientSecretReference?: string;
      certificateReference?: string;
      enabled?: boolean;
    },
  ) {
    requireOrganizationPermission(account, organizationId, "enterprise.sso.manage");
    const health = await this.sso.healthCheck();
    const existing = await this.db.query.enterpriseSsoConfigs.findFirst({
      where: and(
        eq(enterpriseSsoConfigs.organizationId, organizationId),
        eq(enterpriseSsoConfigs.protocol, input.protocol),
      ),
    });
    const metadata = {
      issuer: input.issuer,
      metadataUrl: input.metadataUrl ?? null,
      clientId: input.clientId ?? null,
      certificateReference: input.certificateReference ?? null,
      providerHealth: health.status,
    };
    if (existing) {
      const [row] = await this.db
        .update(enterpriseSsoConfigs)
        .set({
          metadata,
          secretReference: input.clientSecretReference ?? existing.secretReference,
          status:
            health.status === "not_configured"
              ? "not_configured"
              : input.enabled
                ? "configured"
                : "draft",
          updatedAt: new Date(),
        })
        .where(eq(enterpriseSsoConfigs.id, existing.id))
        .returning();
      return { config: row, providerStatus: health.status };
    }
    const [row] = await this.db
      .insert(enterpriseSsoConfigs)
      .values({
        organizationId,
        protocol: input.protocol,
        metadata,
        secretReference: input.clientSecretReference ?? null,
        status: health.status === "not_configured" ? "not_configured" : "draft",
      })
      .returning();
    return { config: row, providerStatus: health.status };
  }

  async listSso(account: SessionAccount, organizationId: string) {
    requireOrganizationPermission(account, organizationId, "enterprise.read");
    return {
      items: await this.db.query.enterpriseSsoConfigs.findMany({
        where: eq(enterpriseSsoConfigs.organizationId, organizationId),
      }),
      provider: await this.sso.healthCheck(),
    };
  }

  async scimConfig(
    account: SessionAccount,
    organizationId: string,
    input: { enabled: boolean; bearerTokenReference: string; baseUrl?: string },
  ) {
    requireOrganizationPermission(account, organizationId, "enterprise.scim.manage");
    const health = await this.scim.healthCheck();
    return {
      organizationId,
      enabled: input.enabled && health.status === "ok",
      bearerTokenReference: input.bearerTokenReference,
      baseUrl: input.baseUrl ?? null,
      providerStatus: health.status,
      note:
        health.status === "not_configured"
          ? "SCIM provider NOT_CONFIGURED — configuração armazenada sem provisionamento."
          : null,
    };
  }

  async upsertSecurityPolicy(
    account: SessionAccount,
    organizationId: string,
    input: {
      mfaPolicy?: string;
      sessionTimeoutMinutes?: number;
      ssoRequired?: boolean;
      allowedAuthMethods?: string[];
      ipAllowlist?: string[];
      apiPolicyNotes?: string;
      defaultLocale?: string;
    },
  ) {
    requireOrganizationPermission(account, organizationId, "enterprise.policies.manage");
    const existing = await this.db.query.organizationSecurityPolicies.findFirst({
      where: eq(organizationSecurityPolicies.organizationId, organizationId),
    });
    const values = {
      mfaPolicy: input.mfaPolicy ?? existing?.mfaPolicy ?? "optional",
      mfaRequired: (input.mfaPolicy ?? existing?.mfaPolicy) === "required_all",
      sessionTimeoutMinutes: input.sessionTimeoutMinutes ?? existing?.sessionTimeoutMinutes ?? 480,
      ssoRequired: input.ssoRequired ?? existing?.ssoRequired ?? false,
      allowedAuthMethods: input.allowedAuthMethods ?? existing?.allowedAuthMethods ?? ["password"],
      ipRestrictions: input.ipAllowlist ?? existing?.ipRestrictions ?? [],
      apiPolicy: {
        ...(existing?.apiPolicy ?? {}),
        notes: input.apiPolicyNotes ?? null,
        defaultLocale:
          input.defaultLocale ??
          (existing?.apiPolicy as { defaultLocale?: string } | null)?.defaultLocale ??
          "pt-BR",
      },
      updatedAt: new Date(),
    };
    if (existing) {
      const [row] = await this.db
        .update(organizationSecurityPolicies)
        .set(values)
        .where(eq(organizationSecurityPolicies.id, existing.id))
        .returning();
      return { policy: row };
    }
    const [row] = await this.db
      .insert(organizationSecurityPolicies)
      .values({ organizationId, ...values })
      .returning();
    return { policy: row };
  }

  async getSecurityPolicy(account: SessionAccount, organizationId: string) {
    requireOrganizationPermission(account, organizationId, "enterprise.read");
    const policy = await this.db.query.organizationSecurityPolicies.findFirst({
      where: eq(organizationSecurityPolicies.organizationId, organizationId),
    });
    return { policy: policy ?? null };
  }

  async createSla(
    account: SessionAccount,
    organizationId: string,
    input: {
      name: string;
      availabilityTargetPercent: number;
      responseTimeHours?: number;
      notes?: string;
    },
  ) {
    requireOrganizationPermission(account, organizationId, "enterprise.sla.manage");
    const [row] = await this.db
      .insert(enterpriseSlas)
      .values({
        organizationId,
        name: input.name,
        status: "draft",
        availabilityTarget: String(input.availabilityTargetPercent),
        responseTimeMinutes: input.responseTimeHours ? input.responseTimeHours * 60 : null,
        metadata: { notes: input.notes ?? null },
      })
      .returning();
    return { sla: row };
  }

  async listSlas(account: SessionAccount, organizationId: string) {
    requireOrganizationPermission(account, organizationId, "enterprise.read");
    return {
      items: await this.db.query.enterpriseSlas.findMany({
        where: eq(enterpriseSlas.organizationId, organizationId),
      }),
    };
  }

  async updateBranding(
    account: SessionAccount,
    organizationId: string,
    input: { displayName?: string; primaryColor?: string; logoAssetId?: string },
  ) {
    requireOrganizationPermission(account, organizationId, "enterprise.branding.manage");
    let config = await this.db.query.whiteLabelConfigs.findFirst({
      where: eq(whiteLabelConfigs.organizationId, organizationId),
    });
    if (!config) {
      const [created] = await this.db
        .insert(whiteLabelConfigs)
        .values({
          organizationId,
          brandName: input.displayName ?? "VerasJuris",
          primaryColor: input.primaryColor ?? "#0F172A",
          logoDocumentId: input.logoAssetId ?? null,
          status: "draft",
        })
        .returning();
      config = created!;
    } else {
      const [updated] = await this.db
        .update(whiteLabelConfigs)
        .set({
          brandName: input.displayName ?? config.brandName,
          primaryColor: input.primaryColor ?? config.primaryColor,
          logoDocumentId: input.logoAssetId ?? config.logoDocumentId,
          updatedAt: new Date(),
        })
        .where(eq(whiteLabelConfigs.id, config.id))
        .returning();
      config = updated!;
    }
    return { branding: config };
  }

  async verifyDomain(account: SessionAccount, organizationId: string, domain: string) {
    requireOrganizationPermission(account, organizationId, "enterprise.domain.manage");
    const health = await this.customDomain.healthCheck();
    if (health.status === "not_configured") {
      await this.db
        .update(whiteLabelConfigs)
        .set({
          customDomain: domain,
          domainVerificationStatus: "verification_pending",
          updatedAt: new Date(),
        })
        .where(eq(whiteLabelConfigs.organizationId, organizationId));
      return {
        domain,
        status: "not_configured" as const,
        detail: health.detail ?? "CustomDomainProvider NOT_CONFIGURED.",
      };
    }
    return this.customDomain.verifyDomainOwnership({ organizationId, domain });
  }
}
