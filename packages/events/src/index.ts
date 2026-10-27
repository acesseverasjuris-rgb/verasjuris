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
