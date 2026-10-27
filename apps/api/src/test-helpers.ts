import type { MemoryEmailProvider } from "@verasjuris/email";
import { CSRF_HEADER, SESSION_COOKIE } from "@verasjuris/security";
import type { FastifyInstance } from "fastify";
import { expect } from "vitest";

export const testPassword = "senha-local-12";

export async function call(
  app: FastifyInstance,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  body?: Record<string, unknown>,
  cookie?: string,
) {
  return app.inject({
    method,
    url,
    ...(body ? { payload: body } : {}),
    headers: {
      [CSRF_HEADER]: "1",
      ...(body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {}),
    },
  });
}

export function sessionFrom(headers: { [key: string]: unknown }): string {
  const raw = headers["set-cookie"];
  const value = Array.isArray(raw) ? raw.join(";") : typeof raw === "string" ? raw : "";
  const match = value.match(/vj_session=([^;]+)/);
  if (!match?.[1]) throw new Error("Cookie de sessão ausente.");
  return match[1];
}

export async function registerVerified(
  app: FastifyInstance,
  email: MemoryEmailProvider,
  input: { displayName: string; email: string; password?: string },
): Promise<string> {
  const password = input.password ?? testPassword;
  const registered = await call(app, "POST", "/v1/auth/register", {
    displayName: input.displayName,
    email: input.email,
    password,
  });
  expect(registered.statusCode).toBe(201);
  expect(registered.headers["set-cookie"]).toBeUndefined();
  const mail = email.latest("email_verification", input.email);
  expect(mail?.token).toBeTruthy();
  const confirmed = await call(app, "POST", "/v1/auth/email-verification/confirm", {
    token: mail?.token,
  });
  expect(confirmed.statusCode).toBe(200);
  const login = await call(app, "POST", "/v1/auth/login", {
    email: input.email,
    password,
  });
  expect(login.statusCode).toBe(200);
  return sessionFrom(login.headers);
}
