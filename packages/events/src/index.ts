export type DomainEventMap = {
  "auth.registered": { userId: string; requestId: string };
  "auth.login_succeeded": { userId: string; requestId: string };
  "organization.created": { organizationId: string; actorUserId: string; requestId: string };
  "membership.changed": {
    organizationId: string;
    membershipId: string;
    actorUserId: string;
    requestId: string;
  };
};

type Handler<T> = (payload: T) => void;

export class InProcessEventBus {
  private readonly handlers = new Map<keyof DomainEventMap, Set<Handler<never>>>();

  publish<K extends keyof DomainEventMap>(name: K, payload: DomainEventMap[K]): void {
    const handlers = this.handlers.get(name);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(payload as never);
    }
  }

  subscribe<K extends keyof DomainEventMap>(
    name: K,
    handler: Handler<DomainEventMap[K]>,
  ): () => void {
    const current = this.handlers.get(name) ?? new Set<Handler<never>>();
    current.add(handler as Handler<never>);
    this.handlers.set(name, current);
    return () => {
      current.delete(handler as Handler<never>);
    };
  }
}

export {
  createJobQueue,
  createJobQueueFromEnv,
  type JobEnqueueOptions,
  type JobHandler,
  type JobQueue,
  type JobQueueEnv,
  type JobQueueStatus,
  type JobRecord,
  type JobStatus,
  LocalInProcessQueueProvider,
  type LocalInProcessQueueOptions,
  NotConfiguredJobQueue,
} from "./queue.js";
export {
  ANALYTICS_EVENTS,
  CONTROL_ANALYTICS_WORKFLOW_EVENT_NAMES,
  CONTROL_EVENTS,
  WORKFLOW_EVENTS,
  type AnalyticsEventName,
  type ControlAnalyticsWorkflowEventName,
  type ControlEventName,
  type WorkflowEventName,
} from "./control-events.js";

export {
  ASSISTANT_EVENTS,
  ENTERPRISE_EVENTS,
  INTEGRATION_EVENTS,
  PLATFORM_EVENT_NAMES,
  PRIVACY_EVENTS,
  SECURITY_EVENTS,
  type AssistantEventName,
  type EnterpriseEventName,
  type IntegrationEventName,
  type PlatformEventName,
  type PrivacyEventName,
  type SecurityEventName,
} from "./platform-events.js";
