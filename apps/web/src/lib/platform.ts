import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { aiErrorMessage, hasPermission, isApiFailure } from "./ai";

export { isApiFailure, aiErrorMessage, hasPermission };

export type ProviderStatus = "CONFIGURED" | "NOT_CONFIGURED" | "DEGRADED" | "FAILED" | "DISABLED";

export type IntegrationRow = {
  key: string;
  type: string;
  status: ProviderStatus;
  configurationStatus?: string;
  lastHealthCheck?: string | null;
  capabilities?: string[];
};

export type SecurityDashboard = {
  mfaAdoptionPercent?: number | null;
  activeSessions?: number | null;
  openAlerts?: number | null;
  openVulnerabilities?: number | null;
  pentestStatus?: string | null;
  providers?: IntegrationRow[];
  events?: Array<{ id: string; type: string; severity: string; createdAt: string }>;
};

export type MfaStatus = {
  status: "DISABLED" | "ENABLED" | "REQUIRED" | "LOCKED";
  methods?: Array<{ id: string; type: string; enabled: boolean }>;
};

export type PasskeyRow = {
  id: string;
  name?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
};

export type DeviceRow = {
  id: string;
  deviceName?: string | null;
  browser?: string | null;
  os?: string | null;
  trusted?: boolean;
  lastSeenAt?: string | null;
  revokedAt?: string | null;
};

export type SecureSessionRow = {
  id: string;
  current?: boolean;
  createdAt: string;
  lastActivityAt?: string | null;
  expiresAt?: string | null;
  ipHint?: string | null;
  userAgentHint?: string | null;
  revokedAt?: string | null;
};

export type PrivacyOverview = {
  consents?: number;
  openDsrs?: number;
  processors?: number;
  incidents?: number;
  dpoConfigured?: boolean;
  dataAssets?: number;
};

export type OperationOverview = {
  health?: string;
  jobs?: Array<{ name: string; status: string; lastRunAt?: string | null }>;
  queues?: Array<{ name: string; depth?: number | null; status: string }>;
  errors?: Array<{ id: string; message: string; createdAt: string }>;
  slos?: Array<{ name: string; target?: string; status: string }>;
};

export type EnterpriseOverview = {
  sso?: { status: ProviderStatus };
  scim?: { status: ProviderStatus };
  domains?: Array<{ domain: string; status: string }>;
  branding?: { status: string };
  policies?: number;
  apiCredentials?: number;
  slas?: Array<{ name: string; status: string }>;
};

export type PublicStatus = {
  overall: string;
  components?: Array<{ name: string; status: string }>;
  updatedAt?: string | null;
};

function orgPath(orgId: string, suffix: string): string {
  return `/api/v1/organizations/${orgId}${suffix}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.method && init.method !== "GET" ? { [CSRF_HEADER]: "1" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    return { httpStatus: 0, error: { code: "network", message: "Falha de rede." } };
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as AiApiFailure;
    return { httpStatus: response.status, ...body };
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export function platformErrorMessage(res: AiApiFailure): string {
  if (res.httpStatus === 404) return "Endpoint ainda não disponível no backend.";
  return aiErrorMessage(res, "Não foi possível concluir a operação.");
}

export async function fetchMeMfa(): Promise<MfaStatus | AiApiFailure> {
  return request("/api/v1/me/security/mfa");
}

export async function enableMeMfa(): Promise<
  { secret?: string; otpauthUrl?: string } | AiApiFailure
> {
  return request("/api/v1/me/security/mfa/enable", { method: "POST", body: "{}" });
}

export async function verifyMeMfa(code: string): Promise<{ ok: true } | AiApiFailure> {
  return request("/api/v1/me/security/mfa/verify", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function fetchMePasskeys(): Promise<{ passkeys: PasskeyRow[] } | AiApiFailure> {
  return request("/api/v1/me/security/passkeys");
}

export async function fetchMeDevices(): Promise<{ devices: DeviceRow[] } | AiApiFailure> {
  return request("/api/v1/me/security/devices");
}

export async function fetchMeSessions(): Promise<{ sessions: SecureSessionRow[] } | AiApiFailure> {
  return request("/api/v1/me/security/sessions");
}

export async function revokeMeSession(sessionId: string): Promise<unknown | AiApiFailure> {
  return request(`/api/v1/me/security/sessions/${sessionId}`, { method: "DELETE" });
}

export async function revokeOtherMeSessions(): Promise<unknown | AiApiFailure> {
  return request("/api/v1/me/security/sessions/revoke-others", { method: "POST", body: "{}" });
}

export async function fetchSecurityDashboard(
  orgId: string,
): Promise<SecurityDashboard | AiApiFailure> {
  return request(orgPath(orgId, "/security/dashboard"));
}

export async function fetchPrivacyOverview(orgId: string): Promise<PrivacyOverview | AiApiFailure> {
  return request(orgPath(orgId, "/privacy"));
}

export async function fetchPrivacyConsents(
  orgId: string,
): Promise<{ items: unknown[] } | AiApiFailure> {
  return request(orgPath(orgId, "/privacy/consents"));
}

export async function fetchPrivacyDsrs(
  orgId: string,
): Promise<{ items: unknown[] } | AiApiFailure> {
  return request(orgPath(orgId, "/privacy/requests"));
}

export async function fetchOperationOverview(
  orgId: string,
): Promise<OperationOverview | AiApiFailure> {
  return request(orgPath(orgId, "/operation"));
}

export async function fetchOperationJobs(
  orgId: string,
): Promise<{ jobs: OperationOverview["jobs"] } | AiApiFailure> {
  return request(orgPath(orgId, "/operation/jobs"));
}

export async function fetchOperationQueues(
  orgId: string,
): Promise<{ queues: OperationOverview["queues"] } | AiApiFailure> {
  return request(orgPath(orgId, "/operation/queues"));
}

export async function fetchEnterpriseOverview(
  orgId: string,
): Promise<EnterpriseOverview | AiApiFailure> {
  return request(orgPath(orgId, "/enterprise"));
}

export async function fetchEnterpriseSso(
  orgId: string,
): Promise<{ status: ProviderStatus; config?: unknown } | AiApiFailure> {
  return request(orgPath(orgId, "/enterprise/sso"));
}

export async function fetchEnterpriseScim(
  orgId: string,
): Promise<{ status: ProviderStatus; config?: unknown } | AiApiFailure> {
  return request(orgPath(orgId, "/enterprise/scim"));
}

export async function fetchEnterpriseDomains(
  orgId: string,
): Promise<{ domains: EnterpriseOverview["domains"] } | AiApiFailure> {
  return request(orgPath(orgId, "/enterprise/domains"));
}

export async function fetchEnterpriseBranding(
  orgId: string,
): Promise<{ status: string; branding?: unknown } | AiApiFailure> {
  return request(orgPath(orgId, "/enterprise/branding"));
}

export async function fetchEnterprisePolicies(
  orgId: string,
): Promise<{ policies: unknown[] } | AiApiFailure> {
  return request(orgPath(orgId, "/enterprise/policies"));
}

export async function fetchEnterpriseApi(
  orgId: string,
): Promise<{ credentials: unknown[] } | AiApiFailure> {
  return request(orgPath(orgId, "/enterprise/api"));
}

export async function fetchEnterpriseSlas(
  orgId: string,
): Promise<{ slas: EnterpriseOverview["slas"] } | AiApiFailure> {
  return request(orgPath(orgId, "/enterprise/slas"));
}

export async function fetchIntegrations(
  orgId: string,
): Promise<{ integrations: IntegrationRow[] } | AiApiFailure> {
  return request(orgPath(orgId, "/integrations"));
}

export async function fetchPublicStatus(): Promise<PublicStatus | AiApiFailure> {
  return request("/api/v1/public/status");
}

export async function updateAccountLocale(input: {
  displayName: string;
  locale: string;
  timeZone: string;
}): Promise<{ profile: { locale: string } } | AiApiFailure> {
  return request("/api/v1/account/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function canAccessSecurityAdmin(permissions: string[]): boolean {
  return (
    hasPermission(permissions, "security.read") || hasPermission(permissions, "security.admin")
  );
}

export function canAccessPrivacy(permissions: string[]): boolean {
  return hasPermission(permissions, "privacy.read") || hasPermission(permissions, "privacy.admin");
}

export function canAccessOperation(permissions: string[]): boolean {
  return (
    hasPermission(permissions, "observability.read") ||
    hasPermission(permissions, "observability.admin") ||
    hasPermission(permissions, "control.read")
  );
}

export function canAccessEnterprise(permissions: string[]): boolean {
  return (
    hasPermission(permissions, "enterprise.read") || hasPermission(permissions, "enterprise.manage")
  );
}

export function canAccessIntegrations(permissions: string[]): boolean {
  return (
    hasPermission(permissions, "integration.read") ||
    hasPermission(permissions, "integration.manage") ||
    hasPermission(permissions, "integrations.admin")
  );
}
