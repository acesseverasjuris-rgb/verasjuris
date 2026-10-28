import {
  createAdministrativeLawCaseSchema,
  createArbitrationCaseSchema,
  createCivilClaimItemSchema,
  createCivilDamageSchema,
  createCivilObligationSchema,
  createConsumerCaseSchema,
  createCorporateCaseSchema,
  createCriminalCaseSchema,
  createCriminalChargeSchema,
  createCustodialMeasureSchema,
  createCustodyArrangementSchema,
  createDigitalCaseSchema,
  createElectoralCaseSchema,
  createEnvironmentalCaseSchema,
  createEstateAssetSchema,
  createEstateCaseSchema,
  createEstateHeirSchema,
  createEstateShareSchema,
  createFamilyRelationshipSchema,
  createInternationalCaseSchema,
  createLegalAreaChecklistSchema,
  createLegalAreaFeatureByKeySchema,
  createLegalAreaTemplatePackSchema,
  createLegalAreaWorkflowConfigSchema,
  createLegalMatterAreaBindingBodySchema,
  createMediationCaseSchema,
  createMedicalCaseSchema,
  createPropertyDivisionSchema,
  createRealEstateAssetSchema,
  createRealEstateCaseSchema,
  createSentencingInformationSchema,
  createSportsCaseSchema,
  createSupportObligationSchema,
  createVersionedRuleSetSchema,
  legalAreaChecklistListQuerySchema,
  legalAreaModuleKeyParamSchema,
  legalAreaModuleListQuerySchema,
  matterExtensionListQuerySchema,
  parseInput,
  uuidSchema,
  versionedRuleSetListQuerySchema,
} from "@verasjuris/validation";
import {
  NotConfiguredElectoralDataProvider,
  NotConfiguredEnvironmentalDataProvider,
  NotConfiguredRegistryProvider,
} from "@verasjuris/ai";
import type { FastifyInstance } from "fastify";
import { meta, requireAccount, type ApiDeps } from "../auth/routes.js";
import {
  createAdministrativeLawCase,
  createArbitrationCase,
  createCivilClaimItem,
  createCivilDamage,
  createCivilObligation,
  createConsumerCase,
  createCorporateCase,
  createCriminalCase,
  createCriminalCharge,
  createCustodialMeasure,
  createCustodyArrangement,
  createDigitalCase,
  createElectoralCase,
  createEnvironmentalCase,
  createEstateAsset,
  createEstateCase,
  createEstateHeir,
  createEstateShare,
  createFamilyRelationship,
  createInternationalCase,
  createLegalAreaChecklist,
  createLegalAreaModuleFeature,
  createLegalAreaTemplatePack,
  createLegalAreaWorkflowConfig,
  createLegalMatterAreaBinding,
  createMediationCase,
  createMedicalCase,
  createPropertyDivision,
  createRealEstateAsset,
  createRealEstateCase,
  createSentencingInformation,
  createSportsCase,
  createSupportObligation,
  createVersionedRuleSet,
  getAreaProvidersStatus,
  getLegalAreaModule,
  getLegalMatterAreaExtensions,
  listAdministrativeLawCases,
  listArbitrationCases,
  listCivilClaimItems,
  listCivilDamages,
  listCivilObligations,
  listConsumerCases,
  listCorporateCases,
  listCriminalCases,
  listCriminalCharges,
  listCustodialMeasures,
  listCustodyArrangements,
  listDigitalCases,
  listElectoralCases,
  listEnvironmentalCases,
  listEstateAssets,
  listEstateCases,
  listEstateHeirs,
  listEstateShares,
  listFamilyRelationships,
  listInternationalCases,
  listLegalAreaChecklists,
  listLegalAreaModuleFeatures,
  listLegalAreaModules,
  listLegalAreaTemplatePacks,
  listLegalAreaWorkflowConfigs,
  listLegalMatterAreaBindings,
  listMediationCases,
  listMedicalCases,
  listPropertyDivisions,
  listRealEstateAssets,
  listRealEstateCases,
  listSentencingInformation,
  listSportsCases,
  listSupportObligations,
  listVersionedRuleSets,
  type LegalAreaModuleDeps,
} from "./service.js";

type Params = {
  organizationId?: string;
  key?: string;
  matterId?: string;
  estateCaseId?: string;
  criminalCaseId?: string;
};

export function legalAreaModuleDeps(deps: ApiDeps): LegalAreaModuleDeps {
  return {
    electoralDataProvider: deps.electoralDataProvider ?? new NotConfiguredElectoralDataProvider(),
    environmentalDataProvider:
      deps.environmentalDataProvider ?? new NotConfiguredEnvironmentalDataProvider(),
    registryProvider: deps.registryProvider ?? new NotConfiguredRegistryProvider(),
  };
}

function omitMatterId<T extends { legalMatterId?: string }>(body: T) {
  const { legalMatterId: _ignored, ...rest } = body;
  return rest;
}

export async function registerLegalAreaRoutes(app: FastifyInstance, deps: ApiDeps) {
  const root = "/organizations/:organizationId";
  const org = (params: Params) => parseInput(uuidSchema, params.organizationId);
  const matter = (params: Params) => parseInput(uuidSchema, params.matterId);
  const moduleKey = (params: Params) => parseInput(legalAreaModuleKeyParamSchema, params.key);
  const moduleDeps = () => legalAreaModuleDeps(deps);
  const extQuery = (query: unknown) => parseInput(matterExtensionListQuerySchema, query ?? {});

  app.get(`${root}/area-providers/status`, async (request) => {
    const account = await requireAccount(deps, request);
    return getAreaProvidersStatus(account, org(request.params as Params), moduleDeps());
  });

  app.get(`${root}/legal-area-modules`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalAreaModuleListQuerySchema, request.query ?? {});
    return listLegalAreaModules(deps.db, account, org(request.params as Params), query);
  });

  app.get(`${root}/legal-area-modules/:key`, async (request) => {
    const account = await requireAccount(deps, request);
    return getLegalAreaModule(
      deps.db,
      account,
      org(request.params as Params),
      moduleKey(request.params as Params),
    );
  });

  app.get(`${root}/legal-area-modules/:key/features`, async (request) => {
    const account = await requireAccount(deps, request);
    return listLegalAreaModuleFeatures(
      deps.db,
      account,
      org(request.params as Params),
      moduleKey(request.params as Params),
    );
  });

  app.post(`${root}/legal-area-modules/:key/features`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLegalAreaFeatureByKeySchema, request.body ?? {});
    const result = await createLegalAreaModuleFeature(
      deps.db,
      account,
      org(request.params as Params),
      moduleKey(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/legal-area-checklists`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(legalAreaChecklistListQuerySchema, request.query ?? {});
    return listLegalAreaChecklists(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/legal-area-checklists`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLegalAreaChecklistSchema, request.body ?? {});
    const result = await createLegalAreaChecklist(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/legal-area-template-packs`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = extQuery(request.query);
    return listLegalAreaTemplatePacks(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/legal-area-template-packs`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLegalAreaTemplatePackSchema, request.body ?? {});
    const result = await createLegalAreaTemplatePack(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/legal-area-workflow-configs`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = extQuery(request.query);
    return listLegalAreaWorkflowConfigs(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/legal-area-workflow-configs`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLegalAreaWorkflowConfigSchema, request.body ?? {});
    const result = await createLegalAreaWorkflowConfig(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/versioned-rule-sets`, async (request) => {
    const account = await requireAccount(deps, request);
    const query = parseInput(versionedRuleSetListQuerySchema, request.query ?? {});
    return listVersionedRuleSets(deps.db, account, org(request.params as Params), query);
  });

  app.post(`${root}/versioned-rule-sets`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createVersionedRuleSetSchema, request.body ?? {});
    const result = await createVersionedRuleSet(
      deps.db,
      account,
      org(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.post(`${root}/legal-matters/:matterId/area-bindings`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createLegalMatterAreaBindingBodySchema, request.body ?? {});
    const result = await createLegalMatterAreaBinding(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      input,
      meta(request),
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/legal-matters/:matterId/area-bindings`, async (request) => {
    const account = await requireAccount(deps, request);
    return listLegalMatterAreaBindings(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
    );
  });

  app.get(`${root}/legal-matters/:matterId/area-extensions`, async (request) => {
    const account = await requireAccount(deps, request);
    return getLegalMatterAreaExtensions(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
    );
  });

  const m = `${root}/legal-matters/:matterId`;

  app.get(`${m}/civil/claim-items`, async (request) => {
    const account = await requireAccount(deps, request);
    return listCivilClaimItems(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/civil/claim-items`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createCivilClaimItemSchema, {
      ...(request.body as object),
      legalMatterId: matter(request.params as Params),
    });
    const result = await createCivilClaimItem(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      omitMatterId(body),
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/civil/damages`, async (request) => {
    const account = await requireAccount(deps, request);
    return listCivilDamages(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/civil/damages`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createCivilDamageSchema, {
      ...(request.body as object),
      legalMatterId: matter(request.params as Params),
    });
    const result = await createCivilDamage(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      omitMatterId(body),
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/civil/obligations`, async (request) => {
    const account = await requireAccount(deps, request);
    return listCivilObligations(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/civil/obligations`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createCivilObligationSchema, {
      ...(request.body as object),
      legalMatterId: matter(request.params as Params),
    });
    const result = await createCivilObligation(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      omitMatterId(body),
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/consumer-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listConsumerCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/consumer-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createConsumerCaseSchema, {
      ...(request.body as object),
      legalMatterId: matter(request.params as Params),
    });
    const result = await createConsumerCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      omitMatterId(body),
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/family/relationships`, async (request) => {
    const account = await requireAccount(deps, request);
    return listFamilyRelationships(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/family/relationships`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createFamilyRelationshipSchema, request.body ?? {});
    const result = await createFamilyRelationship(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/family/custody`, async (request) => {
    const account = await requireAccount(deps, request);
    return listCustodyArrangements(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/family/custody`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createCustodyArrangementSchema, request.body ?? {});
    const result = await createCustodyArrangement(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/family/support`, async (request) => {
    const account = await requireAccount(deps, request);
    return listSupportObligations(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/family/support`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createSupportObligationSchema, request.body ?? {});
    const result = await createSupportObligation(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/family/property-divisions`, async (request) => {
    const account = await requireAccount(deps, request);
    return listPropertyDivisions(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/family/property-divisions`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createPropertyDivisionSchema, request.body ?? {});
    const result = await createPropertyDivision(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/estate-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listEstateCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/estate-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createEstateCaseSchema, {
      ...(request.body as object),
      legalMatterId: matter(request.params as Params),
    });
    const result = await createEstateCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      omitMatterId(body),
    );
    return reply.status(201).send(result);
  });

  const estateCaseId = (params: Params) => parseInput(uuidSchema, params.estateCaseId);

  app.get(`${root}/estate-cases/:estateCaseId/assets`, async (request) => {
    const account = await requireAccount(deps, request);
    return listEstateAssets(
      deps.db,
      account,
      org(request.params as Params),
      estateCaseId(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${root}/estate-cases/:estateCaseId/assets`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createEstateAssetSchema, request.body ?? {});
    const result = await createEstateAsset(
      deps.db,
      account,
      org(request.params as Params),
      estateCaseId(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/estate-cases/:estateCaseId/heirs`, async (request) => {
    const account = await requireAccount(deps, request);
    return listEstateHeirs(
      deps.db,
      account,
      org(request.params as Params),
      estateCaseId(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${root}/estate-cases/:estateCaseId/heirs`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createEstateHeirSchema, request.body ?? {});
    const result = await createEstateHeir(
      deps.db,
      account,
      org(request.params as Params),
      estateCaseId(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/estate-cases/:estateCaseId/shares`, async (request) => {
    const account = await requireAccount(deps, request);
    return listEstateShares(
      deps.db,
      account,
      org(request.params as Params),
      estateCaseId(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${root}/estate-cases/:estateCaseId/shares`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createEstateShareSchema, request.body ?? {});
    const result = await createEstateShare(
      deps.db,
      account,
      org(request.params as Params),
      estateCaseId(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/corporate-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listCorporateCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/corporate-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createCorporateCaseSchema, {
      ...(request.body as object),
      legalMatterId: matter(request.params as Params),
    });
    const result = await createCorporateCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      omitMatterId(body),
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/criminal-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listCriminalCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
      meta(request),
    );
  });
  app.post(`${m}/criminal-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createCriminalCaseSchema, {
      ...(request.body as object),
      legalMatterId: matter(request.params as Params),
    });
    const result = await createCriminalCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      omitMatterId(body),
    );
    return reply.status(201).send(result);
  });

  const criminalCaseId = (params: Params) => parseInput(uuidSchema, params.criminalCaseId);

  app.get(`${root}/criminal-cases/:criminalCaseId/charges`, async (request) => {
    const account = await requireAccount(deps, request);
    return listCriminalCharges(
      deps.db,
      account,
      org(request.params as Params),
      criminalCaseId(request.params as Params),
      extQuery(request.query),
      meta(request),
    );
  });
  app.post(`${root}/criminal-cases/:criminalCaseId/charges`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createCriminalChargeSchema, {
      ...(request.body as object),
      criminalCaseId: criminalCaseId(request.params as Params),
    });
    const { criminalCaseId: _c, ...input } = body;
    const result = await createCriminalCharge(
      deps.db,
      account,
      org(request.params as Params),
      criminalCaseId(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/criminal-cases/:criminalCaseId/measures`, async (request) => {
    const account = await requireAccount(deps, request);
    return listCustodialMeasures(
      deps.db,
      account,
      org(request.params as Params),
      criminalCaseId(request.params as Params),
      extQuery(request.query),
      meta(request),
    );
  });
  app.post(`${root}/criminal-cases/:criminalCaseId/measures`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createCustodialMeasureSchema, request.body ?? {});
    const result = await createCustodialMeasure(
      deps.db,
      account,
      org(request.params as Params),
      criminalCaseId(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${root}/criminal-cases/:criminalCaseId/sentencing`, async (request) => {
    const account = await requireAccount(deps, request);
    return listSentencingInformation(
      deps.db,
      account,
      org(request.params as Params),
      criminalCaseId(request.params as Params),
      extQuery(request.query),
      meta(request),
    );
  });
  app.post(`${root}/criminal-cases/:criminalCaseId/sentencing`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createSentencingInformationSchema, request.body ?? {});
    const result = await createSentencingInformation(
      deps.db,
      account,
      org(request.params as Params),
      criminalCaseId(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/administrative-law-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listAdministrativeLawCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/administrative-law-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createAdministrativeLawCaseSchema, {
      ...(request.body as object),
      legalMatterId: matter(request.params as Params),
    });
    const result = await createAdministrativeLawCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      omitMatterId(body),
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/medical-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listMedicalCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
      meta(request),
    );
  });
  app.post(`${m}/medical-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createMedicalCaseSchema, {
      ...(request.body as object),
      legalMatterId: matter(request.params as Params),
    });
    const result = await createMedicalCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      omitMatterId(body),
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/real-estate-assets`, async (request) => {
    const account = await requireAccount(deps, request);
    return listRealEstateAssets(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/real-estate-assets`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createRealEstateAssetSchema, request.body ?? {});
    const result = await createRealEstateAsset(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/real-estate-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listRealEstateCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/real-estate-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createRealEstateCaseSchema, request.body ?? {});
    const result = await createRealEstateCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/environmental-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listEnvironmentalCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/environmental-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createEnvironmentalCaseSchema, request.body ?? {});
    const result = await createEnvironmentalCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/electoral-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listElectoralCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/electoral-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createElectoralCaseSchema, request.body ?? {});
    const result = await createElectoralCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/sports-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listSportsCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/sports-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createSportsCaseSchema, request.body ?? {});
    const result = await createSportsCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/digital-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listDigitalCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/digital-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createDigitalCaseSchema, request.body ?? {});
    const result = await createDigitalCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/international-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listInternationalCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/international-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const input = parseInput(createInternationalCaseSchema, request.body ?? {});
    const result = await createInternationalCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      input,
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/arbitration-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listArbitrationCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/arbitration-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createArbitrationCaseSchema, {
      ...(request.body as object),
      legalMatterId: matter(request.params as Params),
    });
    const result = await createArbitrationCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      omitMatterId(body),
    );
    return reply.status(201).send(result);
  });

  app.get(`${m}/mediation-cases`, async (request) => {
    const account = await requireAccount(deps, request);
    return listMediationCases(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      extQuery(request.query),
    );
  });
  app.post(`${m}/mediation-cases`, async (request, reply) => {
    const account = await requireAccount(deps, request);
    const body = parseInput(createMediationCaseSchema, {
      ...(request.body as object),
      legalMatterId: matter(request.params as Params),
    });
    const result = await createMediationCase(
      deps.db,
      account,
      org(request.params as Params),
      matter(request.params as Params),
      omitMatterId(body),
    );
    return reply.status(201).send(result);
  });
}
