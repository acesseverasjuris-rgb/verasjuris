import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, hasPermission, isApiFailure } from "./ai";
import { getActiveMembership, getActiveOrgId } from "./crm";
export { getActiveMembership, getActiveOrgId, isApiFailure, aiErrorMessage };

/** Chaves de módulo (catálogo). Tributário tem nav própria — hub exibe as demais 16 áreas. */
export const LEGAL_AREA_MODULE_KEYS = [
  "CIVIL",
  "CONSUMER",
  "FAMILY",
  "SUCCESSION",
  "CORPORATE",
  "CRIMINAL",
  "ADMINISTRATIVE",
  "MEDICAL",
  "REAL_ESTATE",
  "ENVIRONMENTAL",
  "ELECTORAL",
  "SPORTS",
  "DIGITAL",
  "INTERNATIONAL",
  "ARBITRATION",
  "MEDIATION",
] as const;

export type LegalAreaModuleKey = (typeof LEGAL_AREA_MODULE_KEYS)[number];

export type LegalAreaModule = {
  id: string;
  key: LegalAreaModuleKey;
  name: string;
  description?: string | null;
  active: boolean;
  version?: string | null;
  configuration?: Record<string, unknown> | null;
};

export type LegalAreaFeatureConfig = {
  id: string;
  moduleId: string;
  featureKey: string;
  active: boolean;
  configuration?: Record<string, unknown> | null;
};

export const LEGAL_AREA_HUB_LABELS: Record<
  LegalAreaModuleKey,
  { title: string; description: string }
> = {
  CIVIL: {
    title: "Cível",
    description: "Danos, obrigações, responsabilidade civil e contencioso.",
  },
  CONSUMER: { title: "Consumidor", description: "Relações de consumo, contratos e reclamações." },
  FAMILY: { title: "Família", description: "Alimentos, guarda, divórcio e planejamento familiar." },
  SUCCESSION: { title: "Sucessões", description: "Inventários, testamentos e partilhas." },
  CORPORATE: {
    title: "Empresarial",
    description: "Societário, M&A, compliance e contratos empresariais.",
  },
  CRIMINAL: { title: "Penal", description: "Defesa, acusação e revisão de provas." },
  ADMINISTRATIVE: {
    title: "Administrativo",
    description: "Licitações, servidores e poder público.",
  },
  MEDICAL: { title: "Médico", description: "Erro médico, prontuários e responsabilidade." },
  REAL_ESTATE: { title: "Imobiliário", description: "Locação, compra e venda, condomínios." },
  ENVIRONMENTAL: { title: "Ambiental", description: "Licenciamento, infrações e compensações." },
  ELECTORAL: {
    title: "Eleitoral",
    description: "Campanhas, candidaturas e contencioso eleitoral.",
  },
  SPORTS: {
    title: "Desportivo",
    description: "Contratos de atletas, transferências e disciplinar.",
  },
  DIGITAL: { title: "Digital", description: "LGPD, contratos digitais e crimes cibernéticos." },
  INTERNATIONAL: {
    title: "Internacional",
    description: "Contratos internacionais e escolha de lei.",
  },
  ARBITRATION: { title: "Arbitragem", description: "Cláusulas arbitrais, laudos e execução." },
  MEDIATION: { title: "Mediação", description: "Acordos extrajudiciais e negociação assistida." },
};

export type LegalAreaToolLink = {
  href: string;
  label: string;
  description: string;
};

export function legalAreaKeyFromParam(param: string): LegalAreaModuleKey | null {
  const normalized = param.trim().toUpperCase().replace(/-/g, "_");
  return (LEGAL_AREA_MODULE_KEYS as readonly string[]).includes(normalized)
    ? (normalized as LegalAreaModuleKey)
    : null;
}

export function legalAreaRouteKey(key: LegalAreaModuleKey): string {
  return key.toLowerCase().replace(/_/g, "-");
}

export function toolsForLegalArea(key: LegalAreaModuleKey): LegalAreaToolLink[] {
  const common: LegalAreaToolLink[] = [
    { href: "/app/casos", label: "Casos", description: "Matérias e processos vinculados." },
    { href: "/app/documentos", label: "Documentos", description: "Repositório e versões." },
    { href: "/app/prazos", label: "Prazos", description: "Controle de prazos processuais." },
    { href: "/app/tarefas", label: "Tarefas", description: "Checklists e pendências." },
    {
      href: "/app/ia",
      label: "IA assistiva",
      description: "Recursos de apoio com revisão humana.",
    },
  ];
  const byKey: Partial<Record<LegalAreaModuleKey, LegalAreaToolLink[]>> = {
    CONSUMER: [
      { href: "/app/contratos", label: "Contratos", description: "Contratos de consumo e adesão." },
    ],
    CORPORATE: [
      { href: "/app/contratos", label: "Contratos", description: "Gestão contratual empresarial." },
    ],
    DIGITAL: [
      {
        href: "/app/documentos-juridicos",
        label: "Documentos jurídicos",
        description: "Minutas e modelos.",
      },
    ],
  };
  return [...(byKey[key] ?? []), ...common];
}

export function matterCreateHrefForArea(key: LegalAreaModuleKey): string {
  return `/app/casos/novo?legalAreaModule=${encodeURIComponent(key)}`;
}

export type LegalAreaAction = "read" | "manage";

export function hasLegalAreaModuleRead(permissions: readonly string[] | undefined): boolean {
  return (
    hasPermission(permissions, "matter.read") ||
    hasPermission(permissions, "legal_area_module.read")
  );
}

export function hasLegalAreaPermission(
  permissions: readonly string[] | undefined,
  action: LegalAreaAction,
): boolean {
  if (action === "read") return hasLegalAreaModuleRead(permissions);
  return hasPermission(permissions, "legal_area_module.manage");
}

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        [CSRF_HEADER]: "1",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch {
    return {
      error: {
        code: "NETWORK_ERROR",
        message: "Não foi possível falar com o serviço VerasJuris. Nenhuma alteração foi feita.",
      },
    };
  }
  const body = (await response.json().catch(() => ({}))) as T & AiApiFailure;
  if (!response.ok) {
    return {
      httpStatus: response.status,
      error: {
        code: body.error?.code ?? (response.status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR"),
        message: body.error?.message ?? "Falha na requisição.",
        details: body.error?.details,
      },
    };
  }
  return body;
}

function orgPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}${suffix}`;
}

function qs(query: Record<string, string | number | boolean | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** Catálogo estático quando a API ainda não respondeu. */
export function staticLegalAreaModules(): LegalAreaModule[] {
  return LEGAL_AREA_MODULE_KEYS.map((key) => ({
    id: key,
    key,
    name: LEGAL_AREA_HUB_LABELS[key].title,
    description: LEGAL_AREA_HUB_LABELS[key].description,
    active: true,
    version: "1",
  }));
}

export async function fetchLegalAreaModules(
  orgId: string,
  query: { key?: LegalAreaModuleKey; active?: boolean; limit?: number } = {},
) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-area-modules${qs(query)}`),
  );
  if (isApiFailure(data)) return data;
  const items = (data.items ?? []) as LegalAreaModule[];
  if (items.length === 0)
    return {
      items: staticLegalAreaModules(),
      total: LEGAL_AREA_MODULE_KEYS.length,
      fromCatalog: true as const,
    };
  return { items, total: Number(data.total ?? items.length), fromCatalog: false as const };
}

export async function fetchLegalAreaModuleFeatures(orgId: string, moduleId: string) {
  const data = await request<Record<string, unknown>>(
    orgPath(orgId, `/legal-area-modules/${moduleId}/features`),
  );
  if (isApiFailure(data)) return data;
  return { items: (data.items ?? []) as LegalAreaFeatureConfig[] };
}
