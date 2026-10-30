export const PUBLIC_OPENAPI = {
  openapi: "3.0.3",
  info: {
    title: "VerasJuris Public API",
    version: "1.0.0",
    description: "Gateway fino de API pública com autenticação por credencial e escopos.",
  },
  servers: [{ url: "/v1/public" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", description: "Bearer <credentialId>.<secret>" },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/clients": {
      get: {
        summary: "List clients",
        security: [{ bearerAuth: [] }],
        "x-scopes": ["clients.read"],
        responses: { "200": { description: "OK" } },
      },
    },
    "/matters": {
      get: {
        summary: "List matters",
        "x-scopes": ["matters.read"],
        responses: { "200": { description: "OK" } },
      },
    },
    "/documents": {
      get: {
        summary: "List documents",
        "x-scopes": ["documents.read"],
        responses: { "200": { description: "OK" } },
      },
    },
    "/deadlines": {
      get: {
        summary: "List deadlines",
        "x-scopes": ["deadlines.read"],
        responses: { "200": { description: "OK" } },
      },
    },
    "/analytics/summary": {
      get: {
        summary: "Analytics summary",
        "x-scopes": ["analytics.read"],
        responses: { "200": { description: "OK" } },
      },
    },
    "/marketplace/listings": {
      get: {
        summary: "Marketplace listings",
        "x-scopes": ["marketplace.read"],
        responses: { "200": { description: "OK" } },
      },
    },
    "/billing/summary": {
      get: {
        summary: "Billing summary",
        "x-scopes": ["billing.read"],
        responses: { "200": { description: "OK" } },
      },
    },
    "/webhooks": {
      get: {
        summary: "List webhook endpoints",
        "x-scopes": ["webhooks.manage"],
        responses: { "200": { description: "OK" } },
      },
      post: {
        summary: "Create webhook endpoint",
        "x-scopes": ["webhooks.manage"],
        responses: { "201": { description: "Created" } },
      },
    },
  },
} as const;
