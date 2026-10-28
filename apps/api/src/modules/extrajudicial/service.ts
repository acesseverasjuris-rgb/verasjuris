/**
 * Etapa 19 — Cartórios e serviços extrajudiciais.
 * Sem integração cartório fake. Emolumentos oficiais via FeeTableProvider (NOT_CONFIGURED).
 */
import type { FeeTableProvider, PaymentProvider, RegistryProvider } from "@verasjuris/ai";
import { recordAudit } from "@verasjuris/audit";
import {
  policyExtrajudicialOrder,
  policyExtrajudicialRequest,
  type SessionAccount,
} from "@verasjuris/auth";
import {
  extrajudicialDeliveries,
  extrajudicialDocumentTypes,
  extrajudicialOrders,
  extrajudicialQuotes,
  extrajudicialRequirements,
  extrajudicialServiceRequests,
  extrajudicialServiceTypes,
  isUniqueViolation,
  lawyerProfiles,
  registryOffices,
  type AppDatabase,
} from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { and, desc, eq } from "drizzle-orm";
import { authorize, iso } from "../ai/shared.js";
import type { RequestMeta } from "../auth/service.js";

export type ExtrajudicialModuleDeps = {
  paymentProvider: PaymentProvider;
  registryProvider: RegistryProvider;
  feeTableProvider: FeeTableProvider;
};

function must<T>(row: T | undefined, message = "Falha ao persistir registro."): T {
  if (row === undefined) throw new AppError("INTERNAL_ERROR", message);
  return row;
}

const SYSTEM_SERVICE_TYPES = [
  { key: "certidao", name: "Certidão", sortOrder: 10 },
  { key: "reconhecimento", name: "Reconhecimento de firma", sortOrder: 20 },
  { key: "autenticacao", name: "Autenticação", sortOrder: 30 },
  { key: "registro", name: "Registro", sortOrder: 40 },
  { key: "averbacao", name: "Averbação", sortOrder: 50 },
  { key: "protesto", name: "Protesto", sortOrder: 60 },
  { key: "escritura", name: "Escritura", sortOrder: 70 },
  { key: "procuracao", name: "Procuração", sortOrder: 80 },
  { key: "ata_notarial", name: "Ata notarial", sortOrder: 90 },
  { key: "ri", name: "Registro de imóvel", sortOrder: 100 },
  { key: "rcpn", name: "Registro civil", sortOrder: 110 },
  { key: "rtd", name: "RTD", sortOrder: 120 },
  { key: "rcpj", name: "RCPJ", sortOrder: 130 },
  { key: "other", name: "Outros", sortOrder: 999 },
] as const;

export async function ensureExtrajudicialCatalogs(db: AppDatabase) {
  for (const item of SYSTEM_SERVICE_TYPES) {
    await db
      .insert(extrajudicialServiceTypes)
      .values({
        key: item.key,
        name: item.name,
        sortOrder: item.sortOrder,
        isSystem: true,
        active: true,
        officialSupportClaim: "not_configured",
      })
      .onConflictDoNothing({ target: extrajudicialServiceTypes.key });
  }
}

export function getExtrajudicialProvidersStatus(deps: ExtrajudicialModuleDeps) {
  return {
    payment: {
      status: deps.paymentProvider.id === "not_configured" ? "not_configured" : "configured",
    },
    registry: { status: deps.registryProvider.status, key: deps.registryProvider.key },
    feeTable: { status: deps.feeTableProvider.status, key: deps.feeTableProvider.key },
  };
}

export async function listExtrajudicialServiceTypes(db: AppDatabase) {
  await ensureExtrajudicialCatalogs(db);
  const rows = await db
    .select()
    .from(extrajudicialServiceTypes)
    .where(eq(extrajudicialServiceTypes.active, true));
  return {
    types: rows.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      officialSupportClaim: r.officialSupportClaim,
    })),
  };
}

export async function listRegistryOffices(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  filters?: { state?: string; city?: string },
) {
  authorize(account, organizationId, (access) =>
    policyExtrajudicialRequest(access, "extrajudicial.read"),
  );
  const rows = await db.select().from(registryOffices).orderBy(desc(registryOffices.createdAt));
  const filtered = rows.filter((r) => {
    if (filters?.state && r.state !== filters.state.toUpperCase()) return false;
    if (filters?.city && r.city?.toLowerCase() !== filters.city.toLowerCase()) return false;
    return true;
  });
  return {
    offices: filtered.map((r) => ({
      id: r.id,
      name: r.name,
      officeType: r.officeType,
      state: r.state,
      city: r.city,
      address: r.address,
      source: r.source,
      verificationStatus: r.verificationStatus,
      isOfficiallyVerified: r.verificationStatus === "verified" && r.source !== "manual",
    })),
  };
}

export async function createRegistryOffice(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    name: string;
    officeType?: string;
    state?: string;
    city?: string;
    address?: string;
    externalIdentifier?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyExtrajudicialRequest(access, "extrajudicial.manage"),
  );
  const [inserted] = await db
    .insert(registryOffices)
    .values({
      name: input.name,
      officeType: input.officeType ?? "other",
      state: input.state?.toUpperCase() ?? null,
      city: input.city ?? null,
      address: input.address ?? null,
      externalIdentifier: input.externalIdentifier ?? null,
      source: "manual",
      verificationStatus: "unverified",
    })
    .returning();
  const row = must(inserted);
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "extrajudicial.registry_office_created",
    resourceType: "registry_office",
    resourceId: row.id,
    requestId: meta.requestId,
    metadata: { source: "manual", verificationStatus: "unverified" },
  });
  return {
    office: {
      id: row.id,
      name: row.name,
      source: row.source,
      verificationStatus: row.verificationStatus,
      isOfficiallyVerified: false,
    },
  };
}

async function getServiceTypeByKey(db: AppDatabase, key: string) {
  await ensureExtrajudicialCatalogs(db);
  const [type] = await db
    .select()
    .from(extrajudicialServiceTypes)
    .where(eq(extrajudicialServiceTypes.key, key))
    .limit(1);
  if (!type) throw new AppError("NOT_FOUND", "Tipo de serviço extrajudicial não encontrado.");
  return type;
}

function serializeRequest(row: typeof extrajudicialServiceRequests.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    serviceTypeId: row.serviceTypeId,
    registryOfficeId: row.registryOfficeId,
    description: row.description,
    status: row.status,
    acceptedQuoteId: row.acceptedQuoteId,
    jurisdictionState: row.jurisdictionState,
    jurisdictionCity: row.jurisdictionCity,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

async function getRequestInOrg(db: AppDatabase, organizationId: string, requestId: string) {
  const [row] = await db
    .select()
    .from(extrajudicialServiceRequests)
    .where(
      and(
        eq(extrajudicialServiceRequests.id, requestId),
        eq(extrajudicialServiceRequests.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!row) throw new AppError("NOT_FOUND", "Não encontramos esta solicitação extrajudicial.");
  return row;
}

export async function createExtrajudicialServiceRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    serviceTypeKey: string;
    documentTypeKey?: string;
    registryOfficeId?: string;
    clientId?: string;
    legalMatterId?: string;
    jurisdictionState?: string;
    jurisdictionCity?: string;
    description: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyExtrajudicialRequest(access, "extrajudicial.create"),
  );
  const serviceType = await getServiceTypeByKey(db, input.serviceTypeKey);
  let documentTypeId: string | null = null;
  if (input.documentTypeKey) {
    const [docType] = await db
      .select()
      .from(extrajudicialDocumentTypes)
      .where(eq(extrajudicialDocumentTypes.key, input.documentTypeKey))
      .limit(1);
    documentTypeId = docType?.id ?? null;
  }
  if (input.registryOfficeId) {
    const [office] = await db
      .select()
      .from(registryOffices)
      .where(eq(registryOffices.id, input.registryOfficeId))
      .limit(1);
    if (!office) throw new AppError("NOT_FOUND", "Cartório não encontrado.");
  }
  const [inserted] = await db
    .insert(extrajudicialServiceRequests)
    .values({
      organizationId,
      requesterUserId: account.user.id,
      clientId: input.clientId ?? null,
      legalMatterId: input.legalMatterId ?? null,
      serviceTypeId: serviceType.id,
      documentTypeId,
      registryOfficeId: input.registryOfficeId ?? null,
      jurisdictionState: input.jurisdictionState?.toUpperCase() ?? null,
      jurisdictionCity: input.jurisdictionCity ?? null,
      description: input.description,
      status: "draft",
    })
    .returning();
  const row = must(inserted);
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "extrajudicial.request_created",
    resourceType: "extrajudicial_service_request",
    resourceId: row.id,
    requestId: meta.requestId,
  });
  return { request: serializeRequest(row) };
}

export async function listExtrajudicialRequests(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
) {
  authorize(account, organizationId, (access) =>
    policyExtrajudicialRequest(access, "extrajudicial.read"),
  );
  const rows = await db
    .select()
    .from(extrajudicialServiceRequests)
    .where(eq(extrajudicialServiceRequests.organizationId, organizationId))
    .orderBy(desc(extrajudicialServiceRequests.createdAt));
  return { requests: rows.map(serializeRequest) };
}

export async function getExtrajudicialRequest(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
) {
  authorize(account, organizationId, (access) =>
    policyExtrajudicialRequest(access, "extrajudicial.read"),
  );
  return { request: serializeRequest(await getRequestInOrg(db, organizationId, requestId)) };
}

export async function createExtrajudicialQuote(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  input: {
    serviceRequestId: string;
    serviceFeeCents: number;
    estimatedOfficialFeesCents?: number;
    estimatedThirdPartyFeesCents?: number;
    totalEstimateCents: number;
    estimatedDeliveryAt?: string;
    expiresAt?: string;
    notes?: string;
    source?: "manual_estimate" | "provider" | "fee_table" | "other";
    registryOfficeId?: string;
  },
  meta: RequestMeta,
  deps: ExtrajudicialModuleDeps,
) {
  authorize(account, organizationId, (access) =>
    policyExtrajudicialOrder(access, "extrajudicial.quote"),
  );
  const request = await getRequestInOrg(db, organizationId, input.serviceRequestId);
  const source = input.source ?? "manual_estimate";
  if (source === "fee_table" && deps.feeTableProvider.status === "not_configured") {
    throw new AppError(
      "FEE_TABLE_PROVIDER_NOT_CONFIGURED",
      "Tabela oficial de emolumentos não configurada. Use source=manual_estimate.",
    );
  }
  if (source === "provider" && deps.registryProvider.status === "not_configured") {
    throw new AppError(
      "REGISTRY_PROVIDER_NOT_CONFIGURED",
      "RegistryProvider não configurado. Use source=manual_estimate.",
    );
  }
  const [lawyer] = await db
    .select({ userId: lawyerProfiles.userId })
    .from(lawyerProfiles)
    .where(eq(lawyerProfiles.userId, account.user.id))
    .limit(1);
  const [inserted] = await db
    .insert(extrajudicialQuotes)
    .values({
      serviceRequestId: request.id,
      providerProfileId: lawyer?.userId ?? null,
      registryOfficeId: input.registryOfficeId ?? request.registryOfficeId,
      serviceFeeCents: input.serviceFeeCents,
      estimatedOfficialFeesCents: input.estimatedOfficialFeesCents ?? null,
      estimatedThirdPartyFeesCents: input.estimatedThirdPartyFeesCents ?? null,
      totalEstimateCents: input.totalEstimateCents,
      estimatedDeliveryAt: input.estimatedDeliveryAt ? new Date(input.estimatedDeliveryAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      notes: input.notes ?? null,
      source,
      status: "submitted",
    })
    .returning();
  const row = must(inserted);
  await db
    .update(extrajudicialServiceRequests)
    .set({ status: "quote_received", updatedAt: new Date() })
    .where(eq(extrajudicialServiceRequests.id, request.id));
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "extrajudicial.quote_received",
    resourceType: "extrajudicial_quote",
    resourceId: row.id,
    requestId: meta.requestId,
    metadata: { source, officialFeesAreEstimate: source === "manual_estimate" },
  });
  return {
    quote: {
      id: row.id,
      serviceRequestId: row.serviceRequestId,
      serviceFeeCents: row.serviceFeeCents,
      estimatedOfficialFeesCents: row.estimatedOfficialFeesCents,
      estimatedThirdPartyFeesCents: row.estimatedThirdPartyFeesCents,
      totalEstimateCents: row.totalEstimateCents,
      source: row.source,
      status: row.status,
      officialFeesDisclaimer:
        source === "manual_estimate"
          ? "Valor de emolumentos é estimativa manual — não é tabela oficial."
          : null,
    },
  };
}

export async function acceptExtrajudicialQuote(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  requestId: string,
  quoteId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyExtrajudicialOrder(access, "extrajudicial.manage"),
  );
  const request = await getRequestInOrg(db, organizationId, requestId);
  return db.transaction(async (tx) => {
    const [quote] = await tx
      .select()
      .from(extrajudicialQuotes)
      .where(
        and(
          eq(extrajudicialQuotes.id, quoteId),
          eq(extrajudicialQuotes.serviceRequestId, request.id),
        ),
      )
      .limit(1);
    if (!quote || quote.status !== "submitted") {
      throw new AppError("CONFLICT", "Orçamento não está disponível para aceite.");
    }
    await tx
      .update(extrajudicialQuotes)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(extrajudicialQuotes.id, quote.id));
    await tx
      .update(extrajudicialServiceRequests)
      .set({ status: "ordered", acceptedQuoteId: quote.id, updatedAt: new Date() })
      .where(eq(extrajudicialServiceRequests.id, request.id));
    try {
      const [created] = await tx
        .insert(extrajudicialOrders)
        .values({ requestId: request.id, quoteId: quote.id, status: "pending_documents" })
        .returning();
      const order = must(created);
      await recordAudit(tx, {
        organizationId,
        actorUserId: account.user.id,
        source: "api",
        ip: meta.ip,
        action: "extrajudicial.quote_accepted",
        resourceType: "extrajudicial_order",
        resourceId: order.id,
        requestId: meta.requestId,
      });
      await recordAudit(tx, {
        organizationId,
        actorUserId: account.user.id,
        source: "api",
        ip: meta.ip,
        action: "extrajudicial.order_created",
        resourceType: "extrajudicial_order",
        resourceId: order.id,
        requestId: meta.requestId,
      });
      return {
        order: {
          id: order.id,
          requestId: order.requestId,
          quoteId: order.quoteId,
          status: order.status,
          externalProtocol: order.externalProtocol,
          protocolSource: order.protocolSource,
        },
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError("CONFLICT", "Já existe um pedido para esta solicitação.");
      }
      throw error;
    }
  });
}

export async function submitExtrajudicialOrderViaProvider(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  orderId: string,
  meta: RequestMeta,
  deps: ExtrajudicialModuleDeps,
) {
  authorize(account, organizationId, (access) =>
    policyExtrajudicialOrder(access, "extrajudicial.submit"),
  );
  if (deps.registryProvider.status === "not_configured") {
    throw new AppError(
      "REGISTRY_PROVIDER_NOT_CONFIGURED",
      "Envio automático indisponível. Registre protocolo manual com evidência.",
    );
  }
  const [order] = await db
    .select()
    .from(extrajudicialOrders)
    .where(eq(extrajudicialOrders.id, orderId))
    .limit(1);
  if (!order) throw new AppError("NOT_FOUND", "Pedido não encontrado.");
  const request = await getRequestInOrg(db, organizationId, order.requestId);
  const [serviceType] = await db
    .select()
    .from(extrajudicialServiceTypes)
    .where(eq(extrajudicialServiceTypes.id, request.serviceTypeId))
    .limit(1);
  const result = await deps.registryProvider.submitRequest({
    serviceTypeKey: serviceType?.key ?? "other",
    payload: { requestId: request.id, orderId: order.id },
  });
  const [updated] = await db
    .update(extrajudicialOrders)
    .set({
      status: result.externalProtocol ? "protocolled" : "submitted",
      externalProtocol: result.externalProtocol,
      protocolSource: "provider",
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(extrajudicialOrders.id, order.id))
    .returning();
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "extrajudicial.submitted",
    resourceType: "extrajudicial_order",
    resourceId: order.id,
    requestId: meta.requestId,
    metadata: { protocolSource: "provider" },
  });
  return { order: must(updated) };
}

export async function recordManualExtrajudicialProtocol(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  orderId: string,
  input: { externalProtocol: string; protocolEvidenceDocumentId: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyExtrajudicialOrder(access, "extrajudicial.submit"),
  );
  const [order] = await db
    .select()
    .from(extrajudicialOrders)
    .where(eq(extrajudicialOrders.id, orderId))
    .limit(1);
  if (!order) throw new AppError("NOT_FOUND", "Pedido não encontrado.");
  await getRequestInOrg(db, organizationId, order.requestId);
  const [updated] = await db
    .update(extrajudicialOrders)
    .set({
      status: "protocolled",
      externalProtocol: input.externalProtocol,
      protocolSource: "manual",
      protocolEvidenceDocumentId: input.protocolEvidenceDocumentId,
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(extrajudicialOrders.id, orderId))
    .returning();
  const row = must(updated);
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "extrajudicial.submitted",
    resourceType: "extrajudicial_order",
    resourceId: orderId,
    requestId: meta.requestId,
    metadata: { protocolSource: "manual", evidenceDocumentId: input.protocolEvidenceDocumentId },
  });
  return {
    order: {
      id: row.id,
      status: row.status,
      externalProtocol: row.externalProtocol,
      protocolSource: row.protocolSource,
    },
  };
}

export async function createExtrajudicialRequirement(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  orderId: string,
  input: { description: string; dueAt?: string },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyExtrajudicialOrder(access, "extrajudicial.manage"),
  );
  const [order] = await db
    .select()
    .from(extrajudicialOrders)
    .where(eq(extrajudicialOrders.id, orderId))
    .limit(1);
  if (!order) throw new AppError("NOT_FOUND", "Pedido não encontrado.");
  await getRequestInOrg(db, organizationId, order.requestId);
  const [inserted] = await db
    .insert(extrajudicialRequirements)
    .values({
      orderId,
      description: input.description,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      status: "open",
      source: "manual",
    })
    .returning();
  const row = must(inserted);
  await db
    .update(extrajudicialOrders)
    .set({ status: "pending_requirement", updatedAt: new Date() })
    .where(eq(extrajudicialOrders.id, orderId));
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "extrajudicial.requirement_received",
    resourceType: "extrajudicial_requirement",
    resourceId: row.id,
    requestId: meta.requestId,
  });
  return { requirement: row };
}

export async function recordExtrajudicialDelivery(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  orderId: string,
  input: {
    deliveryType?: "digital_document" | "physical_pickup" | "courier" | "registry_portal" | "other";
    documentId?: string;
    externalReference?: string;
    evidenceNotes?: string;
  },
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyExtrajudicialOrder(access, "extrajudicial.complete"),
  );
  const [order] = await db
    .select()
    .from(extrajudicialOrders)
    .where(eq(extrajudicialOrders.id, orderId))
    .limit(1);
  if (!order) throw new AppError("NOT_FOUND", "Pedido não encontrado.");
  await getRequestInOrg(db, organizationId, order.requestId);
  const [inserted] = await db
    .insert(extrajudicialDeliveries)
    .values({
      orderId,
      deliveryType: input.deliveryType ?? "other",
      documentId: input.documentId ?? null,
      externalReference: input.externalReference ?? null,
      evidenceNotes: input.evidenceNotes ?? null,
      deliveredAt: new Date(),
      status: "delivered",
    })
    .returning();
  const delivery = must(inserted);
  await db
    .update(extrajudicialOrders)
    .set({ status: "delivered", updatedAt: new Date() })
    .where(eq(extrajudicialOrders.id, orderId));
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "extrajudicial.delivery_recorded",
    resourceType: "extrajudicial_delivery",
    resourceId: delivery.id,
    requestId: meta.requestId,
  });
  return { delivery };
}

export async function completeExtrajudicialOrder(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  orderId: string,
  meta: RequestMeta,
) {
  authorize(account, organizationId, (access) =>
    policyExtrajudicialOrder(access, "extrajudicial.complete"),
  );
  const [order] = await db
    .select()
    .from(extrajudicialOrders)
    .where(eq(extrajudicialOrders.id, orderId))
    .limit(1);
  if (!order) throw new AppError("NOT_FOUND", "Pedido não encontrado.");
  await getRequestInOrg(db, organizationId, order.requestId);
  const [updated] = await db
    .update(extrajudicialOrders)
    .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(extrajudicialOrders.id, orderId))
    .returning();
  const row = must(updated);
  await db
    .update(extrajudicialServiceRequests)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(extrajudicialServiceRequests.id, order.requestId));
  await recordAudit(db, {
    organizationId,
    actorUserId: account.user.id,
    source: "api",
    ip: meta.ip,
    action: "extrajudicial.completed",
    resourceType: "extrajudicial_order",
    resourceId: orderId,
    requestId: meta.requestId,
  });
  return { order: { id: row.id, status: row.status, completedAt: iso(row.completedAt) } };
}

export async function getExtrajudicialPaymentStatus(
  _db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  deps: ExtrajudicialModuleDeps,
) {
  authorize(account, organizationId, (access) =>
    policyExtrajudicialOrder(access, "extrajudicial.read"),
  );
  if (deps.paymentProvider.id === "not_configured") {
    return {
      status: "not_configured" as const,
      message: "Pagamento automático indisponível. Registro manual com evidência permitido.",
    };
  }
  return { status: "configured" as const };
}
