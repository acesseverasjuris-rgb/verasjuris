import {
  ACTIVE_ORGANIZATION_COOKIE,
  CSRF_HEADER,
  SESSION_COOKIE,
} from "@verasjuris/security/constants";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { activeOrganizationId, getSession } from "../../../lib/session";
import { apiInternalUrl } from "../../../lib/types";

export async function GET() {
  const session = await getSession();
  if (session.state !== "authenticated") {
    return NextResponse.json({ organizationId: null });
  }
  const organizationId = await activeOrganizationId(session.account);
  return NextResponse.json({ organizationId });
}

function csrfDenied(message: string) {
  return NextResponse.json({ error: { message } }, { status: 403 });
}

export async function DELETE(request: Request) {
  if (request.headers.get(CSRF_HEADER) !== "1") {
    return csrfDenied(
      "A requisição não tem a proteção exigida. A organização ativa não foi alterada.",
    );
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}

export async function POST(request: Request) {
  if (request.headers.get(CSRF_HEADER) !== "1") {
    return csrfDenied(
      "A requisição não tem a proteção exigida. A organização ativa não foi alterada.",
    );
  }
  const body = (await request.json().catch(() => null)) as { organizationId?: string } | null;
  const organizationId = body?.organizationId ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) {
    return NextResponse.json(
      { error: { message: "O identificador da organização não é válido. Nada foi alterado." } },
      { status: 400 },
    );
  }
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const upstream = await fetch(`${apiInternalUrl()}/v1/organizations/${organizationId}/switch`, {
    method: "POST",
    headers: {
      cookie: `${SESSION_COOKIE}=${token ?? ""}`,
      [CSRF_HEADER]: "1",
    },
    cache: "no-store",
  });
  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: {
          message:
            "Essa organização não está disponível para a sua conta. A seleção não foi alterada.",
        },
      },
      { status: upstream.status },
    );
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return response;
}
