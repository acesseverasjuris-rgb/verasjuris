import type { AppDatabase } from "@verasjuris/database";
import { institutionalPolicies, institutionalPolicyVersions } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq, isNull } from "drizzle-orm";

export class InstitutionalService {
  constructor(private readonly db: AppDatabase) {}

  async list(locale?: string) {
    const policies = await this.db.query.institutionalPolicies.findMany({
      where: locale
        ? and(
            isNull(institutionalPolicies.organizationId),
            eq(institutionalPolicies.locale, locale),
          )
        : isNull(institutionalPolicies.organizationId),
      orderBy: [desc(institutionalPolicies.updatedAt)],
    });
    return {
      items: policies.map((p) => ({
        id: p.id,
        key: p.key,
        title: p.title,
        category: p.category,
        locale: p.locale,
      })),
    };
  }

  async getBySlug(slug: string, locale = "pt-BR") {
    const policy = await this.db.query.institutionalPolicies.findFirst({
      where: and(
        isNull(institutionalPolicies.organizationId),
        eq(institutionalPolicies.key, slug),
        eq(institutionalPolicies.locale, locale),
      ),
    });
    if (!policy) throw new AppError("NOT_FOUND", "Política institucional não encontrada.");
    const version = await this.db.query.institutionalPolicyVersions.findFirst({
      where: and(
        eq(institutionalPolicyVersions.policyId, policy.id),
        eq(institutionalPolicyVersions.status, "published"),
      ),
      orderBy: [desc(institutionalPolicyVersions.version)],
    });
    return {
      policy: {
        id: policy.id,
        key: policy.key,
        title: policy.title,
        locale: policy.locale,
        category: policy.category,
        content: version?.content ?? null,
        version: version?.version ?? null,
        publishedAt: version?.publishedAt?.toISOString() ?? null,
      },
    };
  }
}
