import { AppError } from "@verasjuris/types";

/**
 * Observabilidade: métricas, tracing, erros, uptime e alertas.
 * Defaults: not_configured — sem SDKs externos.
 */

export type ObservabilityHealth = {
  status: "ok" | "degraded" | "unavailable" | "not_configured";
  detail?: string;
  checkedAt: string;
};

export type MetricPoint = {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp?: string;
};

export interface MetricsProvider {
  readonly id: string;
  increment(name: string, value?: number, tags?: Record<string, string>): Promise<void>;
  gauge(name: string, value: number, tags?: Record<string, string>): Promise<void>;
  timing(name: string, durationMs: number, tags?: Record<string, string>): Promise<void>;
  flush?(signal?: AbortSignal): Promise<void>;
  healthCheck(): Promise<ObservabilityHealth>;
}

export type TraceSpanInput = {
  name: string;
  traceId?: string;
  parentSpanId?: string;
  attributes?: Record<string, string | number | boolean>;
};

export type TraceSpanHandle = {
  spanId: string;
  traceId: string;
  end(status?: "ok" | "error", errorMessage?: string): Promise<void>;
};

export interface TracingProvider {
  readonly id: string;
  startSpan(input: TraceSpanInput): Promise<TraceSpanHandle>;
  healthCheck(): Promise<ObservabilityHealth>;
}

export type ErrorTrackingEvent = {
  message: string;
  name?: string;
  stack?: string;
  level?: "error" | "warning" | "info";
  tags?: Record<string, string>;
  userId?: string;
  organizationId?: string;
  requestId?: string;
};

export interface ErrorTrackingProvider {
  readonly id: string;
  captureException(error: unknown, context?: Omit<ErrorTrackingEvent, "message">): Promise<void>;
  captureMessage(event: ErrorTrackingEvent): Promise<void>;
  healthCheck(): Promise<ObservabilityHealth>;
}

export type UptimeCheckResult = {
  providerKey: string;
  status: "up" | "down" | "degraded" | "not_configured";
  checkedAt: string;
  latencyMs: number | null;
  detail?: string;
};

export interface UptimeProvider {
  readonly id: string;
  check(targetKey: string, signal?: AbortSignal): Promise<UptimeCheckResult>;
  healthCheck(): Promise<ObservabilityHealth>;
}

export type AlertSeverity = "info" | "warning" | "critical";

export type AlertDispatchInput = {
  title: string;
  body: string;
  severity: AlertSeverity;
  channel?: string;
  tags?: Record<string, string>;
  signal?: AbortSignal;
};

export type AlertDispatchResult = {
  providerKey: string;
  status: "sent" | "queued" | "failed" | "not_configured";
  externalAlertId: string | null;
  detail?: string;
};

export interface AlertingProvider {
  readonly id: string;
  dispatch(input: AlertDispatchInput): Promise<AlertDispatchResult>;
  healthCheck(): Promise<ObservabilityHealth>;
}

/** Agregado opcional — compose dos providers acima. */
export interface ObservabilityProvider {
  readonly id: string;
  readonly metrics: MetricsProvider;
  readonly tracing: TracingProvider;
  readonly errors: ErrorTrackingProvider;
  readonly uptime: UptimeProvider;
  readonly alerting: AlertingProvider;
  healthCheck(): Promise<ObservabilityHealth>;
}

const MESSAGE = "Nenhum provedor de observabilidade está configurado.";

function notConfiguredHealth(): Promise<ObservabilityHealth> {
  return Promise.resolve({
    status: "not_configured",
    detail: MESSAGE,
    checkedAt: new Date().toISOString(),
  });
}

export class NotConfiguredMetricsProvider implements MetricsProvider {
  readonly id = "not_configured";
  increment(): Promise<void> {
    return Promise.resolve();
  }
  gauge(): Promise<void> {
    return Promise.resolve();
  }
  timing(): Promise<void> {
    return Promise.resolve();
  }
  healthCheck(): Promise<ObservabilityHealth> {
    return notConfiguredHealth();
  }
}

export class NotConfiguredTracingProvider implements TracingProvider {
  readonly id = "not_configured";
  startSpan(input: TraceSpanInput): Promise<TraceSpanHandle> {
    const spanId = "not_configured";
    const traceId = input.traceId ?? "not_configured";
    return Promise.resolve({
      spanId,
      traceId,
      end: async () => undefined,
    });
  }
  healthCheck(): Promise<ObservabilityHealth> {
    return notConfiguredHealth();
  }
}

export class NotConfiguredErrorTrackingProvider implements ErrorTrackingProvider {
  readonly id = "not_configured";
  captureException(): Promise<void> {
    return Promise.resolve();
  }
  captureMessage(): Promise<void> {
    return Promise.resolve();
  }
  healthCheck(): Promise<ObservabilityHealth> {
    return notConfiguredHealth();
  }
}

export class NotConfiguredUptimeProvider implements UptimeProvider {
  readonly id = "not_configured";
  check(_targetKey: string, _signal?: AbortSignal): Promise<UptimeCheckResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      checkedAt: new Date().toISOString(),
      latencyMs: null,
      detail: MESSAGE,
    });
  }
  healthCheck(): Promise<ObservabilityHealth> {
    return notConfiguredHealth();
  }
}

export class NotConfiguredAlertingProvider implements AlertingProvider {
  readonly id = "not_configured";
  dispatch(_input: AlertDispatchInput): Promise<AlertDispatchResult> {
    return Promise.resolve({
      providerKey: "not_configured",
      status: "not_configured",
      externalAlertId: null,
      detail: MESSAGE,
    });
  }
  healthCheck(): Promise<ObservabilityHealth> {
    return notConfiguredHealth();
  }
}

export class NotConfiguredObservabilityProvider implements ObservabilityProvider {
  readonly id = "not_configured";
  readonly metrics = new NotConfiguredMetricsProvider();
  readonly tracing = new NotConfiguredTracingProvider();
  readonly errors = new NotConfiguredErrorTrackingProvider();
  readonly uptime = new NotConfiguredUptimeProvider();
  readonly alerting = new NotConfiguredAlertingProvider();
  healthCheck(): Promise<ObservabilityHealth> {
    return notConfiguredHealth();
  }
}

export function observabilityProviderNotConfiguredError(): AppError {
  return new AppError("NOT_CONFIGURED", MESSAGE);
}
