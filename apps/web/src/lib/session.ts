import { ACTIVE_ORGANIZATION_COOKIE, SESSION_COOKIE } from "@verasjuris/security/constants";
import { cookies } from "next/headers";
import { apiInternalUrl, type Account } from "./types";

export type SessionResult =
  | { state: "authenticated"; account: Account }
  | { state: "anonymous" }
  | { state: "unavailable"; message: string };

export async function getSession(): Promise<SessionResult> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return { state: "anonymous" };
  try {
    const response = await fetch(`${apiInternalUrl()}/v1/auth/session`, {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
      cache: "no-store",
    });
    if (response.status === 401) return { state: "anonymous" };
    if (!response.ok) {
      return {
        state: "unavailable",
        message:
          "Não foi possível confirmar sua sessão. Nenhum dado foi alterado. Tente novamente.",
      };
    }
    const body = (await response.json()) as { account: Account };
    return { state: "authenticated", account: body.account };
  } catch {
    return {
      state: "unavailable",
      message: "Não foi possível falar com o serviço VerasJuris. Nenhuma alteração foi feita.",
    };
  }
}

export async function activeOrganizationId(account: Account): Promise<string | null> {
  const jar = await cookies();
  const requested = jar.get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  const available = account.memberships.filter(
    (membership) => membership.membershipStatus === "active",
  );
  if (requested && available.some((membership) => membership.organizationId === requested))
    return requested;
  return available[0]?.organizationId ?? null;
}
