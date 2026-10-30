import type { AppDatabase } from "@verasjuris/database";
import { apiClientScopes, apiClients, apiCredentials, apiScopes } from "@verasjuris/database";
import { verifyPassword } from "@verasjuris/security";
import { AppError } from "@verasjuris/types";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyRequest } from "fastify";

export type PublicApiAuthContext = {
  organizationId: string;
  apiClientId: string;
  credentialId: string;
  scopes: string[];
};

function parseBearer(request: FastifyRequest): { credentialId: string; secret: string } | null {
  const header = request.headers.authorization;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw?.startsWith("Bearer ")) return null;
  const token = raw.slice("Bearer ".length).trim();
  // Format: vj_<credentialId>.<secret> or credentialId:secret
  if (token.includes(".")) {
    const [credentialId, ...rest] = token.split(".");
    return { credentialId: credentialId!, secret: rest.join(".") };
  }
  if (token.includes(":")) {
    const [credentialId, ...rest] = token.split(":");
    return { credentialId: credentialId!, secret: rest.join(":") };
  }
  return null;
}

export async function authenticateApiCredential(
  db: AppDatabase,
  request: FastifyRequest,
): Promise<PublicApiAuthContext> {
  const parsed = parseBearer(request);
  if (!parsed) {
    throw new AppError("AUTHENTICATION_ERROR", "Credencial de API ausente ou inválida.");
  }
  const cred = await db.query.apiCredentials.findFirst({
    where: and(
      eq(apiCredentials.credentialId, parsed.credentialId),
      isNull(apiCredentials.revokedAt),
    ),
  });
  if (!cred) throw new AppError("AUTHENTICATION_ERROR", "Credencial de API inválida.");
  const ok = await verifyPassword(parsed.secret, cred.secretHash);
  if (!ok) throw new AppError("AUTHENTICATION_ERROR", "Credencial de API inválida.");

  const client = await db.query.apiClients.findFirst({
    where: eq(apiClients.id, cred.apiClientId),
  });
  if (!client || client.status !== "active") {
    throw new AppError("AUTHENTICATION_ERROR", "Cliente de API inativo ou inexistente.");
  }

  const links = await db.query.apiClientScopes.findMany({
    where: eq(apiClientScopes.apiClientId, client.id),
  });
  const scopeIds = links.map((l) => l.scopeId);
  const scopes =
    scopeIds.length === 0
      ? []
      : (
          await db.query.apiScopes.findMany({
            where: eq(apiScopes.id, scopeIds[0]!),
          })
        ).map((s) => s.key);

  // Load all scopes properly
  const allScopes = await db.query.apiScopes.findMany();
  const allowed = new Set(scopeIds);
  const scopeKeys = allScopes.filter((s) => allowed.has(s.id)).map((s) => s.key);

  await db
    .update(apiCredentials)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiCredentials.id, cred.id));

  return {
    organizationId: client.organizationId,
    apiClientId: client.id,
    credentialId: cred.credentialId,
    scopes: scopeKeys.length ? scopeKeys : scopes,
  };
}

export function requireApiScope(ctx: PublicApiAuthContext, scope: string): void {
  if (!ctx.scopes.includes(scope) && !ctx.scopes.includes("read")) {
    throw new AppError("AUTHORIZATION_ERROR", `Escopo ${scope} não concedido a esta credencial.`);
  }
}
