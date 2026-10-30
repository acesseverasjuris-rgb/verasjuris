import {
  type AIGateway,
  type AuctionBidProvider,
  type AuctionProvider,
  CitationEngine,
  createAiGatewayFromEnv,
  createResearchGatewayFromEnv,
  type CNISProvider,
  type ESocialProvider,
  type FederalTaxProvider,
  type FGTSProvider,
  type MunicipalTaxProvider,
  type StateTaxProvider,
  type TaxDebtProvider,
  type TaxFilingProvider,
  type LaborCourtProvider,
  NotConfiguredAuctionBidProvider,
  NotConfiguredAuctionProvider,
  NotConfiguredCNISProvider,
  NotConfiguredESocialProvider,
  NotConfiguredFederalTaxProvider,
  NotConfiguredFGTSProvider,
  NotConfiguredLaborCourtProvider,
  NotConfiguredMunicipalTaxProvider,
  NotConfiguredStateTaxProvider,
  NotConfiguredTaxDebtProvider,
  NotConfiguredTaxFilingProvider,
  NotConfiguredElectoralDataProvider,
  NotConfiguredEnvironmentalDataProvider,
  NotConfiguredRegistryProvider,
  NotConfiguredEmailProvider,
  NotConfiguredPushProvider,
  NotConfiguredSmsProvider,
  NotConfiguredWhatsAppProvider,
  type EmailProvider as CommunicationEmailProvider,
  type PushProvider,
  type SmsProvider,
  type WhatsAppProvider,
  type ElectoralDataProvider,
  type EnvironmentalDataProvider,
  type RegistryProvider,
  NotConfiguredOCRProvider,
  NotConfiguredPublicOpportunityProvider,
  NotConfiguredSocialSecurityProvider,
  NotConfiguredTimeTrackingImportProvider,
  NotConfiguredConflictCheckProvider,
  NotConfiguredContractManagementProvider,
  NotConfiguredOABVerificationProvider,
  NotConfiguredCPFVerificationProvider,
  NotConfiguredDocumentVerificationProvider,
  NotConfiguredBiometricVerificationProvider,
  NotConfiguredFeeTableProvider,
  NotConfiguredPaymentProvider,
  NotConfiguredPayoutProvider,
  NotConfiguredBankingProvider,
  NotConfiguredTaxWithholdingProvider,
  NotConfiguredCustomDomainProvider,
  NotConfiguredDebtCollectionProvider,
  NotConfiguredLicenseProvider,
  NotConfiguredPaymentDisputeProvider,
  NotConfiguredReconciliationProvider,
  NotConfiguredSignatureProvider,
  NotConfiguredVideoConferenceProvider,
  NotConfiguredBIProvider,
  NotConfiguredAnalyticsWarehouseProvider,
  NotConfiguredIssueTrackerProvider,
  NotConfiguredDeploymentProvider,
  NotConfiguredWorkflowWebhookProvider,
  NotConfiguredCourtIntegrationProvider,
  NotConfiguredKeyManagementProvider,
  NotConfiguredObservabilityProvider,
  NotConfiguredStatusPageProvider,
  NotConfiguredBackupProvider,
  NotConfiguredTranslationProvider,
  NotConfiguredSSOProvider,
  NotConfiguredSCIMProvider,
  type ProviderRegistry,
  createProviderRegistry,
  type BIProvider,
  type AnalyticsWarehouseProvider,
  type IssueTrackerProvider,
  type DeploymentProvider,
  type WorkflowWebhookProvider,
  type CourtIntegrationProvider,
  type KeyManagementProvider,
  type ObservabilityProvider,
  type StatusPageProvider,
  type BackupProvider,
  type TranslationProvider,
  type SSOProvider,
  type SCIMProvider,
  type BiometricVerificationProvider,
  type ConflictCheckProvider,
  type ContractManagementProvider,
  type CPFVerificationProvider,
  type DocumentVerificationProvider,
  type FeeTableProvider,
  type OABVerificationProvider,
  type OCRProvider,
  type PaymentProvider,
  type PayoutProvider,
  type BankingProvider,
  type TaxWithholdingProvider,
  type CustomDomainProvider,
  type DebtCollectionProvider,
  type LicenseProvider,
  type PaymentDisputeProvider,
  type ReconciliationProvider,
  type SignatureProvider,
  type VideoConferenceProvider,
  type PublicOpportunityProvider,
  type ResearchGateway,
  type SocialSecurityProvider,
  type TimeTrackingImportProvider,
} from "@verasjuris/ai";
import { InProcessEventBus } from "@verasjuris/events";
import { createEmailProvider, type EmailProvider } from "@verasjuris/email";
import {
  InAppNotificationProvider,
  NotConfiguredHolidayCalendar,
  type HolidayCalendarProvider,
  type NotificationProvider,
} from "@verasjuris/notifications";
import { MemoryRateLimiter } from "@verasjuris/security";
import {
  createMalwareScanner,
  createStorageProvider,
  type MalwareScannerProvider,
  type StorageProvider,
} from "@verasjuris/storage";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import type { AppDatabase } from "@verasjuris/database";
import Fastify, { type FastifyBaseLogger, LogController } from "fastify";
import type { Logger } from "pino";
import { registerAuthRoutes, type ApiDeps } from "./modules/auth/routes.js";
import { registerHealthRoutes } from "./modules/health/routes.js";
import { registerCrmRoutes } from "./modules/crm/routes.js";
import { registerIntakeRoutes } from "./modules/intake/routes.js";
import { registerAdministrativeRoutes } from "./modules/administrative/routes.js";
import { registerCalendarRoutes } from "./modules/calendar/routes.js";
import { registerDeadlineRoutes } from "./modules/deadlines/routes.js";
import { registerDocumentRoutes } from "./modules/documents/routes.js";
import { registerDossierRoutes } from "./modules/dossier/routes.js";
import { registerJudicialRoutes } from "./modules/judicial/routes.js";
import { registerMatterRoutes } from "./modules/matters/routes.js";
import { registerPipelineRoutes } from "./modules/pipeline/routes.js";
import {
  registerAccountRoutes,
  registerOrganizationRoutes,
} from "./modules/organizations/routes.js";
import { registerAiRoutes } from "./modules/ai/routes.js";
import { registerDocumentIntelligenceRoutes } from "./modules/document-intelligence/routes.js";
import { registerLegalAnalysisRoutes } from "./modules/legal-analysis/routes.js";
import { registerLegalReviewRoutes } from "./modules/legal-review/routes.js";
import { registerLegalTemplateRoutes } from "./modules/legal-templates/routes.js";
import { registerLegalDraftRoutes } from "./modules/legal-drafts/routes.js";
import { registerProfileRoutes } from "./modules/profiles/routes.js";
import { registerPublicOpportunityRoutes } from "./modules/public-opportunities/routes.js";
import { registerAuctionRoutes } from "./modules/auctions/routes.js";
import { registerAuctionPostRoutes } from "./modules/auction-post/routes.js";
import { registerLegalComparisonRoutes } from "./modules/legal-comparisons/routes.js";
import { registerLegalResearchRoutes } from "./modules/legal-research/routes.js";
import { registerCitationRoutes } from "./modules/citations/routes.js";
import { registerLaborRoutes } from "./modules/labor/routes.js";
import { registerPrevidentiaryRoutes } from "./modules/previdentiary/routes.js";
import { registerTaxRoutes } from "./modules/tax/routes.js";
import { registerContractRoutes } from "./modules/contracts/routes.js";
import { registerLegalAreaRoutes } from "./modules/legal-areas/routes.js";
import { registerClientPortalRoutes } from "./modules/client-portal/routes.js";
import { registerOnlineLawyerRoutes } from "./modules/online-lawyer/routes.js";
import { registerMarketplaceRoutes } from "./modules/marketplace/routes.js";
import { registerProfessionalVerificationRoutes } from "./modules/professional-verification/routes.js";
import { registerDiligenceRoutes } from "./modules/diligence/routes.js";
import { registerExtrajudicialRoutes } from "./modules/extrajudicial/routes.js";
import { registerCommunicationRoutes } from "./modules/communication/routes.js";
import { registerEducationRoutes } from "./modules/education/routes.js";
import { registerFinanceRoutes } from "./modules/finance/routes.js";
import { registerTaskRoutes } from "./modules/tasks/routes.js";
import { registerControlRoutes } from "./modules/control/routes.js";
import { registerAnalyticsRoutes } from "./modules/analytics/routes.js";
import { registerWorkflowRoutes } from "./modules/workflows/routes.js";
import { registerIntegrationRoutes } from "./modules/integrations/routes.js";
import { registerSecurityRoutes } from "./modules/security/routes.js";
import { registerPrivacyRoutes } from "./modules/privacy/routes.js";
import {
  registerObservabilityRoutes,
  registerObservabilityRootHealth,
} from "./modules/observability/routes.js";
import { registerEnterpriseRoutes } from "./modules/enterprise/routes.js";
import { registerAccessibilityRoutes } from "./modules/accessibility/routes.js";
import { registerI18nRoutes } from "./modules/i18n/routes.js";
import { registerAssistantRoutes } from "./modules/assistant/routes.js";
import { registerPublicApiRoutes } from "./modules/public-api/routes.js";
import { registerInstitutionalRoutes } from "./modules/institutional/routes.js";
import { registerHttpGuards } from "./plugins/http.js";
import type { JobQueue } from "@verasjuris/events";

export type BuildAppOptions = {
  db: AppDatabase;
  logger: Logger | boolean;
  webOrigin: string;
  isProduction: boolean;
  rateLimiter?: MemoryRateLimiter;
  events?: InProcessEventBus;
  email?: EmailProvider;
  storage?: StorageProvider;
  malwareScanner?: MalwareScannerProvider;
  documentMaxUploadBytes?: number;
  notifications?: NotificationProvider;
  holidays?: HolidayCalendarProvider;
  /** Padrão: gateway NOT_CONFIGURED (nenhum texto é gerado). Testes injetam provedor determinístico. */
  aiGateway?: AIGateway;
  ocrProvider?: OCRProvider;
  publicOpportunityProvider?: PublicOpportunityProvider;
  /** Padrão: ResearchGateway NOT_CONFIGURED (sem resultados inventados). */
  researchGateway?: ResearchGateway;
  citationEngine?: CitationEngine;
  /** Padrão: AuctionProvider NOT_CONFIGURED (cadastro manual ativo; sem sync inventado). */
  auctionProvider?: AuctionProvider;
  /** Padrão: AuctionBidProvider NOT_CONFIGURED (sem lance real). */
  auctionBidProvider?: AuctionBidProvider;
  /** Padrão: eSocial NOT_CONFIGURED. */
  eSocialProvider?: ESocialProvider;
  /** Padrão: FGTS NOT_CONFIGURED (nunca saldo oficial). */
  fgtsProvider?: FGTSProvider;
  /** Padrão: LaborCourt NOT_CONFIGURED (sem scraping). */
  laborCourtProvider?: LaborCourtProvider;
  /** Padrão: TimeTrackingImport NOT_CONFIGURED (cadastro manual ativo). */
  timeTrackingImportProvider?: TimeTrackingImportProvider;
  /** Padrão: SocialSecurityProvider NOT_CONFIGURED (sem sync inventado). */
  socialSecurityProvider?: SocialSecurityProvider;
  /** Padrão: CNISProvider NOT_CONFIGURED (importação manual ativa). */
  cnisProvider?: CNISProvider;
  /** Padrão: FederalTaxProvider NOT_CONFIGURED. */
  federalTaxProvider?: FederalTaxProvider;
  /** Padrão: StateTaxProvider NOT_CONFIGURED. */
  stateTaxProvider?: StateTaxProvider;
  /** Padrão: MunicipalTaxProvider NOT_CONFIGURED. */
  municipalTaxProvider?: MunicipalTaxProvider;
  /** Padrão: TaxDebtProvider NOT_CONFIGURED. */
  taxDebtProvider?: TaxDebtProvider;
  /** Padrão: TaxFilingProvider NOT_CONFIGURED. */
  taxFilingProvider?: TaxFilingProvider;
  /** Padrão: SignatureProvider NOT_CONFIGURED (registro manual ativo). */
  signatureProvider?: SignatureProvider;
  /** Padrão: ContractManagementProvider NOT_CONFIGURED. */
  contractManagementProvider?: ContractManagementProvider;
  /** Dados eleitorais; ausente = NOT_CONFIGURED. */
  electoralDataProvider?: ElectoralDataProvider;
  /** Dados ambientais; ausente = NOT_CONFIGURED. */
  environmentalDataProvider?: EnvironmentalDataProvider;
  /** Registros públicos; ausente = NOT_CONFIGURED. */
  registryProvider?: RegistryProvider;
  paymentProvider?: PaymentProvider;
  /** Padrão: PayoutProvider NOT_CONFIGURED (nunca marca PAID). */
  payoutProvider?: PayoutProvider;
  /** Padrão: BankingProvider NOT_CONFIGURED. */
  bankingProvider?: BankingProvider;
  /** Padrão: TaxWithholdingProvider NOT_CONFIGURED (sem retenção oficial inventada). */
  taxWithholdingProvider?: TaxWithholdingProvider;
  /** Padrão: CustomDomainProvider NOT_CONFIGURED. */
  customDomainProvider?: CustomDomainProvider;
  /** Padrão: DebtCollectionProvider NOT_CONFIGURED. */
  debtCollectionProvider?: DebtCollectionProvider;
  /** Padrão: LicenseProvider NOT_CONFIGURED. */
  licenseProvider?: LicenseProvider;
  /** Padrão: PaymentDisputeProvider NOT_CONFIGURED (nunca finge won/lost). */
  paymentDisputeProvider?: PaymentDisputeProvider;
  /** Padrão: ReconciliationProvider NOT_CONFIGURED. */
  reconciliationProvider?: ReconciliationProvider;
  oabVerificationProvider?: OABVerificationProvider;
  cpfVerificationProvider?: CPFVerificationProvider;
  documentVerificationProvider?: DocumentVerificationProvider;
  biometricVerificationProvider?: BiometricVerificationProvider;
  feeTableProvider?: FeeTableProvider;
  conflictCheckProvider?: ConflictCheckProvider;
  videoConferenceProvider?: VideoConferenceProvider;
  communicationEmailProvider?: CommunicationEmailProvider;
  communicationSmsProvider?: SmsProvider;
  communicationWhatsappProvider?: WhatsAppProvider;
  communicationPushProvider?: PushProvider;
  /** Padrão: BI NOT_CONFIGURED. */
  biProvider?: BIProvider;
  /** Padrão: warehouse NOT_CONFIGURED. */
  warehouseProvider?: AnalyticsWarehouseProvider;
  /** Padrão: issue tracker NOT_CONFIGURED. */
  issueTrackerProvider?: IssueTrackerProvider;
  /** Padrão: deployment NOT_CONFIGURED. */
  deploymentProvider?: DeploymentProvider;
  /** Padrão: workflow webhook NOT_CONFIGURED. */
  workflowWebhookProvider?: WorkflowWebhookProvider;
  courtIntegrationProvider?: CourtIntegrationProvider;
  keyManagementProvider?: KeyManagementProvider;
  observabilityProvider?: ObservabilityProvider;
  statusPageProvider?: StatusPageProvider;
  backupProvider?: BackupProvider;
  translationProvider?: TranslationProvider;
  ssoProvider?: SSOProvider;
  scimProvider?: SCIMProvider;
  jobQueue?: JobQueue;
  appEncryptionKey?: string | null;
  providerRegistry?: ProviderRegistry;
};

export async function buildApp(options: BuildAppOptions) {
  const documentMaxUploadBytes = options.documentMaxUploadBytes ?? 10 * 1024 * 1024;
  const app = Fastify({
    ...(typeof options.logger === "boolean"
      ? { logger: options.logger }
      : { loggerInstance: options.logger as FastifyBaseLogger }),
    logController: new LogController({ disableRequestLogging: true }),
    trustProxy: true,
    requestIdHeader: "x-request-id",
    bodyLimit: 64 * 1024,
  });
  const deps: ApiDeps = {
    db: options.db,
    events: options.events ?? new InProcessEventBus(),
    rateLimiter: options.rateLimiter ?? new MemoryRateLimiter(),
    secureCookies: options.isProduction,
    email: options.email ?? createEmailProvider("not_configured"),
    webOrigin: options.webOrigin,
    storage: options.storage ?? createStorageProvider(process.env),
    malwareScanner: options.malwareScanner ?? createMalwareScanner(process.env),
    documentMaxUploadBytes,
    notifications: options.notifications ?? new InAppNotificationProvider(),
    holidays: options.holidays ?? new NotConfiguredHolidayCalendar(),
    aiGateway:
      options.aiGateway ??
      createAiGatewayFromEnv({ FEATURE_AI: process.env.FEATURE_AI, AI_PROVIDER: "not_configured" }),
    ocrProvider: options.ocrProvider ?? new NotConfiguredOCRProvider(),
    publicOpportunityProvider:
      options.publicOpportunityProvider ?? new NotConfiguredPublicOpportunityProvider(),
    researchGateway:
      options.researchGateway ??
      createResearchGatewayFromEnv({
        LEGAL_SOURCE_PROVIDER: process.env.LEGAL_SOURCE_PROVIDER ?? "not_configured",
      }),
    citationEngine: options.citationEngine ?? new CitationEngine(),
    auctionProvider: options.auctionProvider ?? new NotConfiguredAuctionProvider(),
    auctionBidProvider: options.auctionBidProvider ?? new NotConfiguredAuctionBidProvider(),
    eSocialProvider: options.eSocialProvider ?? new NotConfiguredESocialProvider(),
    fgtsProvider: options.fgtsProvider ?? new NotConfiguredFGTSProvider(),
    laborCourtProvider: options.laborCourtProvider ?? new NotConfiguredLaborCourtProvider(),
    timeTrackingImportProvider:
      options.timeTrackingImportProvider ?? new NotConfiguredTimeTrackingImportProvider(),
    socialSecurityProvider:
      options.socialSecurityProvider ?? new NotConfiguredSocialSecurityProvider(),
    cnisProvider: options.cnisProvider ?? new NotConfiguredCNISProvider(),
    federalTaxProvider: options.federalTaxProvider ?? new NotConfiguredFederalTaxProvider(),
    stateTaxProvider: options.stateTaxProvider ?? new NotConfiguredStateTaxProvider(),
    municipalTaxProvider: options.municipalTaxProvider ?? new NotConfiguredMunicipalTaxProvider(),
    taxDebtProvider: options.taxDebtProvider ?? new NotConfiguredTaxDebtProvider(),
    taxFilingProvider: options.taxFilingProvider ?? new NotConfiguredTaxFilingProvider(),
    signatureProvider: options.signatureProvider ?? new NotConfiguredSignatureProvider(),
    contractManagementProvider:
      options.contractManagementProvider ?? new NotConfiguredContractManagementProvider(),
    electoralDataProvider:
      options.electoralDataProvider ?? new NotConfiguredElectoralDataProvider(),
    environmentalDataProvider:
      options.environmentalDataProvider ?? new NotConfiguredEnvironmentalDataProvider(),
    registryProvider: options.registryProvider ?? new NotConfiguredRegistryProvider(),
    paymentProvider: options.paymentProvider ?? new NotConfiguredPaymentProvider(),
    payoutProvider: options.payoutProvider ?? new NotConfiguredPayoutProvider(),
    bankingProvider: options.bankingProvider ?? new NotConfiguredBankingProvider(),
    taxWithholdingProvider:
      options.taxWithholdingProvider ?? new NotConfiguredTaxWithholdingProvider(),
    customDomainProvider: options.customDomainProvider ?? new NotConfiguredCustomDomainProvider(),
    debtCollectionProvider:
      options.debtCollectionProvider ?? new NotConfiguredDebtCollectionProvider(),
    licenseProvider: options.licenseProvider ?? new NotConfiguredLicenseProvider(),
    paymentDisputeProvider:
      options.paymentDisputeProvider ?? new NotConfiguredPaymentDisputeProvider(),
    reconciliationProvider:
      options.reconciliationProvider ?? new NotConfiguredReconciliationProvider(),
    oabVerificationProvider:
      options.oabVerificationProvider ?? new NotConfiguredOABVerificationProvider(),
    cpfVerificationProvider:
      options.cpfVerificationProvider ?? new NotConfiguredCPFVerificationProvider(),
    documentVerificationProvider:
      options.documentVerificationProvider ?? new NotConfiguredDocumentVerificationProvider(),
    biometricVerificationProvider:
      options.biometricVerificationProvider ?? new NotConfiguredBiometricVerificationProvider(),
    feeTableProvider: options.feeTableProvider ?? new NotConfiguredFeeTableProvider(),
    conflictCheckProvider:
      options.conflictCheckProvider ?? new NotConfiguredConflictCheckProvider(),
    videoConferenceProvider:
      options.videoConferenceProvider ?? new NotConfiguredVideoConferenceProvider(),
    communicationEmailProvider:
      options.communicationEmailProvider ?? new NotConfiguredEmailProvider(),
    communicationSmsProvider: options.communicationSmsProvider ?? new NotConfiguredSmsProvider(),
    communicationWhatsappProvider:
      options.communicationWhatsappProvider ?? new NotConfiguredWhatsAppProvider(),
    communicationPushProvider: options.communicationPushProvider ?? new NotConfiguredPushProvider(),
    biProvider: options.biProvider ?? new NotConfiguredBIProvider(),
    warehouseProvider: options.warehouseProvider ?? new NotConfiguredAnalyticsWarehouseProvider(),
    issueTrackerProvider: options.issueTrackerProvider ?? new NotConfiguredIssueTrackerProvider(),
    deploymentProvider: options.deploymentProvider ?? new NotConfiguredDeploymentProvider(),
    workflowWebhookProvider:
      options.workflowWebhookProvider ?? new NotConfiguredWorkflowWebhookProvider(),
    courtIntegrationProvider:
      options.courtIntegrationProvider ?? new NotConfiguredCourtIntegrationProvider(),
    keyManagementProvider:
      options.keyManagementProvider ?? new NotConfiguredKeyManagementProvider(),
    observabilityProvider:
      options.observabilityProvider ?? new NotConfiguredObservabilityProvider(),
    statusPageProvider: options.statusPageProvider ?? new NotConfiguredStatusPageProvider(),
    backupProvider: options.backupProvider ?? new NotConfiguredBackupProvider(),
    translationProvider: options.translationProvider ?? new NotConfiguredTranslationProvider(),
    ssoProvider: options.ssoProvider ?? new NotConfiguredSSOProvider(),
    scimProvider: options.scimProvider ?? new NotConfiguredSCIMProvider(),
    jobQueue: options.jobQueue,
    appEncryptionKey: options.appEncryptionKey ?? process.env.APP_ENCRYPTION_KEY ?? null,
    providerRegistry: options.providerRegistry,
  };
  if (!deps.providerRegistry) {
    const registry = createProviderRegistry();
    const registerNotConfigured = (
      key: string,
      type: string,
      healthCheck: () => Promise<{ status: string; detail?: string; checkedAt: string }>,
    ) => {
      registry.register({
        key,
        type,
        status: "not_configured",
        capabilities: [],
        healthCheck: async () => {
          const h = await healthCheck();
          return { status: h.status, detail: h.detail, checkedAt: h.checkedAt };
        },
      });
    };
    registerNotConfigured("court", "court", () => deps.courtIntegrationProvider!.healthCheck());
    registerNotConfigured("kms", "security", () => deps.keyManagementProvider!.healthCheck());
    registerNotConfigured("observability", "observability", () =>
      deps.observabilityProvider!.healthCheck(),
    );
    registerNotConfigured("status_page", "observability", () =>
      deps.statusPageProvider!.healthCheck(),
    );
    registerNotConfigured("backup", "observability", () => deps.backupProvider!.healthCheck());
    registerNotConfigured("translation", "i18n", () => deps.translationProvider!.healthCheck());
    registerNotConfigured("sso", "enterprise", () => deps.ssoProvider!.healthCheck());
    registerNotConfigured("scim", "enterprise", () => deps.scimProvider!.healthCheck());
    registerNotConfigured("custom_domain", "enterprise", () =>
      deps.customDomainProvider!.healthCheck(),
    );
    registerNotConfigured("payment", "finance", () => deps.paymentProvider!.healthCheck());
    registerNotConfigured("signature", "contracts", () => deps.signatureProvider!.healthCheck());
    registerNotConfigured("email", "communication", () =>
      deps.communicationEmailProvider!.healthCheck(),
    );
    registerNotConfigured("whatsapp", "communication", () =>
      deps.communicationWhatsappProvider!.healthCheck(),
    );
    registerNotConfigured("workflow_webhook", "workflows", () =>
      deps.workflowWebhookProvider!.healthCheck(),
    );
    deps.providerRegistry = registry;
  }
  await app.register(helmet, { global: true, contentSecurityPolicy: false });
  await app.register(cors, {
    origin: options.webOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: [
      "content-type",
      "x-verasjuris-request",
      "x-request-id",
      "idempotency-key",
      "x-idempotency-key",
    ],
  });
  await app.register(cookie);
  await app.register(multipart, {
    limits: {
      fileSize: documentMaxUploadBytes,
      files: 1,
    },
  });
  registerHttpGuards(app, { webOrigin: options.webOrigin });
  registerHealthRoutes(app, options.db);
  await app.register(
    async (v1) => {
      await registerAuthRoutes(v1, deps);
      await registerOrganizationRoutes(v1, deps);
      await registerAccountRoutes(v1, deps);
      await registerProfileRoutes(v1, deps);
      await registerCrmRoutes(v1, deps);
      await registerIntakeRoutes(v1, deps);
      await registerPipelineRoutes(v1, deps);
      await registerMatterRoutes(v1, deps);
      await registerJudicialRoutes(v1, deps);
      await registerAdministrativeRoutes(v1, deps);
      await registerDocumentRoutes(v1, deps);
      await registerDossierRoutes(v1, deps);
      await registerTaskRoutes(v1, deps);
      await registerCalendarRoutes(v1, deps);
      await registerDeadlineRoutes(v1, deps);
      await registerAiRoutes(v1, deps);
      await registerDocumentIntelligenceRoutes(v1, deps);
      await registerLegalAnalysisRoutes(v1, deps);
      await registerLegalReviewRoutes(v1, deps);
      await registerLegalTemplateRoutes(v1, deps);
      await registerLegalDraftRoutes(v1, deps);
      await registerPublicOpportunityRoutes(v1, deps);
      await registerAuctionRoutes(v1, deps);
      await registerAuctionPostRoutes(v1, deps);
      await registerLegalComparisonRoutes(v1, deps);
      await registerLegalResearchRoutes(v1, deps);
      await registerCitationRoutes(v1, deps);
      await registerLaborRoutes(v1, deps);
      await registerPrevidentiaryRoutes(v1, deps);
      await registerTaxRoutes(v1, deps);
      await registerContractRoutes(v1, deps);
      await registerLegalAreaRoutes(v1, deps);
      await registerClientPortalRoutes(v1, deps);
      await registerOnlineLawyerRoutes(v1, deps);
      await registerMarketplaceRoutes(v1, deps);
      await registerProfessionalVerificationRoutes(v1, deps);
      await registerDiligenceRoutes(v1, deps);
      await registerExtrajudicialRoutes(v1, deps);
      await registerCommunicationRoutes(v1, deps);
      await registerEducationRoutes(v1, deps);
      await registerFinanceRoutes(v1, deps);
      await registerControlRoutes(v1, deps);
      await registerAnalyticsRoutes(v1, deps);
      await registerWorkflowRoutes(v1, deps);
      await registerIntegrationRoutes(v1, deps);
      await registerSecurityRoutes(v1, deps);
      await registerPrivacyRoutes(v1, deps);
      await registerObservabilityRoutes(v1, deps);
      await registerEnterpriseRoutes(v1, deps);
      await registerAccessibilityRoutes(v1, deps);
      await registerI18nRoutes(v1, deps);
      await registerAssistantRoutes(v1, deps);
      await registerInstitutionalRoutes(v1, deps);
    },
    { prefix: "/v1" },
  );
  await app.register(
    async (pub) => {
      await registerPublicApiRoutes(pub, deps);
    },
    { prefix: "/v1/public" },
  );
  await app.register(
    async (pub) => {
      await registerPublicApiRoutes(pub, deps);
    },
    { prefix: "/api/public/v1" },
  );
  registerObservabilityRootHealth(app, deps);
  app.get("/developers/openapi.json", async (_request, reply) => {
    const { PUBLIC_OPENAPI } = await import("./modules/public-api/openapi.js");
    return reply.send(PUBLIC_OPENAPI);
  });
  return app;
}
