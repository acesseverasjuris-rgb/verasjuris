import type { TranslationProvider } from "@verasjuris/ai";
import type { SessionAccount } from "@verasjuris/auth";
import type { AppDatabase } from "@verasjuris/database";
import { contentTranslations, organizationSecurityPolicies, profiles } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, eq } from "drizzle-orm";
import { requireOrganizationPermission } from "../auth/routes.js";
import {
  assertJurisdictionForBrRules,
  requireDeclaredJurisdiction,
  type JurisdictionContext,
} from "./jurisdiction.js";

export class I18nService {
  constructor(
    private readonly db: AppDatabase,
    private readonly translation: TranslationProvider,
  ) {}

  async updateLocalePreferences(
    account: SessionAccount,
    input: { locale: string; timeZone: string; currency?: string },
  ) {
    await this.db
      .update(profiles)
      .set({ locale: input.locale, timeZone: input.timeZone, updatedAt: new Date() })
      .where(eq(profiles.userId, account.user.id));
    return {
      preferences: {
        locale: input.locale,
        timeZone: input.timeZone,
        currency: input.currency ?? null,
      },
    };
  }

  async setOrganizationDefaultLocale(
    account: SessionAccount,
    organizationId: string,
    locale: string,
  ) {
    requireOrganizationPermission(account, organizationId, "i18n.manage");
    const existing = await this.db.query.organizationSecurityPolicies.findFirst({
      where: eq(organizationSecurityPolicies.organizationId, organizationId),
    });
    const apiPolicy = { ...(existing?.apiPolicy ?? {}), defaultLocale: locale };
    if (existing) {
      await this.db
        .update(organizationSecurityPolicies)
        .set({ apiPolicy, updatedAt: new Date() })
        .where(eq(organizationSecurityPolicies.id, existing.id));
    } else {
      await this.db.insert(organizationSecurityPolicies).values({
        organizationId,
        apiPolicy,
      });
    }
    return { defaultLocale: locale };
  }

  async createTranslation(
    account: SessionAccount,
    organizationId: string | null,
    input: {
      sourceType: string;
      sourceId: string;
      sourceLanguage: string;
      targetLanguage: string;
      translatedText?: string;
      provider?: string;
      status?: "pending" | "machine_translated" | "reviewed" | "failed" | "not_configured";
      reviewed?: boolean;
    },
  ) {
    if (organizationId) requireOrganizationPermission(account, organizationId, "i18n.manage");
    const [row] = await this.db
      .insert(contentTranslations)
      .values({
        organizationId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        translatedText: input.translatedText ?? "",
        provider: input.provider ?? "manual",
        status: input.status ?? (input.translatedText ? "reviewed" : "pending"),
        reviewed: input.reviewed ?? Boolean(input.translatedText),
      })
      .returning();
    return { translation: row };
  }

  async requestMachineTranslation(
    account: SessionAccount,
    organizationId: string,
    input: { text: string; sourceLanguage?: string; targetLanguage: string },
  ) {
    requireOrganizationPermission(account, organizationId, "i18n.manage");
    const result = await this.translation.translate({
      text: input.text,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
    });
    if (result.status === "not_configured") {
      throw new AppError("NOT_CONFIGURED", result.detail ?? "TranslationProvider não configurado.");
    }
    return { result };
  }

  checkBrCalculationJurisdiction(ctx: JurisdictionContext) {
    const declared = requireDeclaredJurisdiction(ctx);
    assertJurisdictionForBrRules(declared, "brazilian_calculation");
    return { ok: true, jurisdiction: declared };
  }

  async listTranslations(account: SessionAccount, organizationId: string) {
    requireOrganizationPermission(account, organizationId, "i18n.read");
    return {
      items: await this.db.query.contentTranslations.findMany({
        where: eq(contentTranslations.organizationId, organizationId),
      }),
    };
  }
}
