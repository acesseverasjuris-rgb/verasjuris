export const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  AUTHENTICATION_ERROR: 401,
  AUTHORIZATION_ERROR: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMIT: 429,
  NOT_CONFIGURED: 503,
  EXTERNAL_SERVICE_ERROR: 503,
  INTERNAL_ERROR: 500,
  AI_PROVIDER_NOT_CONFIGURED: 503,
  AI_PROVIDER_UNAVAILABLE: 503,
  AI_PROVIDER_RATE_LIMITED: 429,
  AI_PROVIDER_TIMEOUT: 504,
  AI_INVALID_RESPONSE: 502,
  AI_BUDGET_EXCEEDED: 402,
  OCR_PROVIDER_NOT_CONFIGURED: 503,
  PUBLIC_OPPORTUNITY_PROVIDER_NOT_CONFIGURED: 503,
  LEGAL_SOURCE_PROVIDER_NOT_CONFIGURED: 503,
  AUCTION_PROVIDER_NOT_CONFIGURED: 503,
  AUCTION_BID_PROVIDER_NOT_CONFIGURED: 503,
  MAP_PROVIDER_NOT_CONFIGURED: 503,
  SOCIAL_SECURITY_PROVIDER_NOT_CONFIGURED: 503,
  CNIS_PROVIDER_NOT_CONFIGURED: 503,
  ESOCIAL_PROVIDER_NOT_CONFIGURED: 503,
  FGTS_PROVIDER_NOT_CONFIGURED: 503,
  LABOR_COURT_PROVIDER_NOT_CONFIGURED: 503,
  TIME_TRACKING_IMPORT_PROVIDER_NOT_CONFIGURED: 503,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export type FieldIssue = {
  path: string;
  message: string;
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: readonly FieldIssue[] | undefined;

  constructor(code: ErrorCode, message: string, details?: readonly FieldIssue[]) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
  }
}

export type ErrorResponseBody = {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
    details?: readonly FieldIssue[];
  };
};
