import { CSRF_HEADER } from "@verasjuris/security";
import { AppError, type ErrorCode, type ErrorResponseBody } from "@verasjuris/types";
import type { FastifyInstance } from "fastify";

function publicError(
  code: ErrorCode,
  message: string,
  requestId: string,
  details?: ErrorResponseBody["error"]["details"],
): ErrorResponseBody {
  return {
    error: {
      code,
      message,
      requestId,
      ...(details && details.length > 0 ? { details } : {}),
    },
  };
}

function originAllowed(value: string | undefined, webOrigin: string): boolean {
  if (!value) return true;
  try {
    return new URL(value).origin === new URL(webOrigin).origin;
  } catch {
    return false;
  }
}

export function registerHttpGuards(app: FastifyInstance, options: { webOrigin: string }): void {
  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id);
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;

    // Webhooks de provedores externos não enviam CSRF browser header.
    const path = request.url.split("?")[0] ?? "";
    if (path.includes("/webhooks/")) return;

    const header = request.headers[CSRF_HEADER];
    const value = Array.isArray(header) ? header[0] : header;
    if (value !== "1") {
      throw new AppError(
        "AUTHORIZATION_ERROR",
        "A requisição não tem a proteção exigida. Nenhuma alteração foi confirmada.",
      );
    }

    const originHeader = request.headers.origin;
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
    const refererHeader = request.headers.referer;
    const referer = Array.isArray(refererHeader) ? refererHeader[0] : refererHeader;
    if (!originAllowed(origin, options.webOrigin) || !originAllowed(referer, options.webOrigin)) {
      throw new AppError(
        "AUTHORIZATION_ERROR",
        "A origem da requisição não é permitida. Nenhuma alteração foi confirmada.",
      );
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    request.log.info({
      requestId: request.id,
      method: request.method,
      route: request.routeOptions.url ?? "unmatched",
      status: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
    });
  });

  app.setNotFoundHandler((request, reply) => {
    return reply
      .status(404)
      .send(publicError("NOT_FOUND", "Não encontramos este recurso.", request.id));
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      if (error.status >= 500)
        request.log.error({ requestId: request.id, code: error.code }, error.message);
      return reply
        .status(error.status)
        .send(publicError(error.code, error.message, request.id, error.details));
    }
    const fastifyError = error as { statusCode?: number; code?: string };
    if (fastifyError.statusCode === 400 || fastifyError.code === "FST_ERR_CTP_INVALID_JSON") {
      return reply
        .status(400)
        .send(
          publicError(
            "VALIDATION_ERROR",
            "O conteúdo enviado não pôde ser lido. Nenhuma alteração foi confirmada.",
            request.id,
          ),
        );
    }
    request.log.error(
      {
        requestId: request.id,
        errName: error instanceof Error ? error.name : "Error",
        errMessage: error instanceof Error ? error.message : "erro desconhecido",
      },
      "Erro não tratado",
    );
    return reply
      .status(500)
      .send(
        publicError(
          "INTERNAL_ERROR",
          "Não foi possível concluir esta ação. Nenhuma alteração foi confirmada. Tente novamente.",
          request.id,
        ),
      );
  });
}
