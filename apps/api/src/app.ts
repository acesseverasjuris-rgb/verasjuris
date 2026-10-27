import {
  type AIGateway,
  type AuctionBidProvider,
  type AuctionProvider,
  CitationEngine,
  createAiGatewayFromEnv,
  createResearchGatewayFromEnv,
  type CNISProvider,
  type ESocialProvider,
  type FGTSProvider,
  type LaborCourtProvider,
  NotConfiguredAuctionBidProvider,
  NotConfiguredAuctionProvider,
  NotConfiguredCNISProvider,
  NotConfiguredESocialProvider,
  NotConfiguredFGTSProvider,
  NotConfiguredLaborCourtProvider,
  NotConfiguredOCRProvider,
  NotConfiguredPublicOpportunityProvider,
  NotConfiguredSocialSecurityProvider,
  NotConfiguredTimeTrackingImportProvider,
  type OCRProvider,
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
import { registerTaskRoutes } from "./modules/tasks/routes.js";
import { registerHttpGuards } from "./plugins/http.js";

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
  };
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
    },
    { prefix: "/v1" },
  );
  return app;
}
