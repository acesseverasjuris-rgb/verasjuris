import {
  assertInternalControlOrganization,
  type AccessDecision,
  type AccessMembership,
  type SessionAccount,
} from "@verasjuris/auth";
import { readInternalOrganizationConfig } from "@verasjuris/config";
import { organizations, type AppDatabase } from "@verasjuris/database";
import { AppError } from "@verasjuris/types";
import { eq } from "drizzle-orm";
import { accessOf, authorize, membershipOf } from "../ai/shared.js";

export async function loadOrganizationForControl(db: AppDatabase, organizationId: string) {
  const [org] = await db
    .select({
      id: organizations.id,
      internalCompany: organizations.internalCompany,
      status: organizations.status,
      name: organizations.name,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return org ?? null;
}

/**
 * Authorize Control access: membership + permission + internal org gate.
 * Cross-tenant / non-internal → NOT_FOUND (never AUTHORIZATION_ERROR for isolation).
 */
export async function authorizeControl(
  db: AppDatabase,
  account: SessionAccount,
  organizationId: string,
  check: (access: AccessMembership) => AccessDecision,
) {
  const org = await loadOrganizationForControl(db, organizationId);
  const access = accessOf(account, organizationId);
  const membership = membershipOf(account, organizationId);
  assertInternalControlOrganization(
    {
      ...(access ?? {
        status: "removed",
        organizationStatus: "suspended",
        permissions: [],
        roles: [],
      }),
      organizationId: membership?.organizationId ?? organizationId,
    },
    org,
    readInternalOrganizationConfig(),
  );
  return authorize(account, organizationId, check);
}

export function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Data inválida.");
  }
  return d;
}

export function requireDate(value: string): Date {
  const d = parseDate(value);
  if (!d) throw new AppError("VALIDATION_ERROR", "Data obrigatória.");
  return d;
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function mapApprovalPolicy(
  policy: "single" | "sequential" | "parallel" | "threshold",
): "single" | "sequential" | "parallel" | "threshold_based" {
  return policy === "threshold" ? "threshold_based" : policy;
}

export function mapIncidentSeverity(severity: string): "critical" | "high" | "medium" | "low" {
  if (severity === "sev1" || severity === "critical") return "critical";
  if (severity === "sev2" || severity === "high") return "high";
  if (severity === "sev3" || severity === "medium") return "medium";
  if (severity === "sev4" || severity === "low") return "low";
  return "medium";
}

export function mapBugSeverity(severity: string): "critical" | "high" | "medium" | "low" {
  return mapIncidentSeverity(severity);
}

export function computeRiskScore(likelihood: number, impact: number): number {
  return likelihood * impact;
}
