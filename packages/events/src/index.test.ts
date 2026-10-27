import { describe, expect, it } from "vitest";
import {
  createJobQueue,
  createJobQueueFromEnv,
  InProcessEventBus,
  LocalInProcessQueueProvider,
} from "./index.js";

describe("eventos e fila", () => {
  it("entrega um evento para o assinante", () => {
    const bus = new InProcessEventBus();
    const received: string[] = [];
    bus.subscribe("organization.created", (event) => {
      received.push(event.organizationId);
    });
    bus.publish("organization.created", {
      organizationId: "org-1",
      actorUserId: "user-1",
      requestId: "req-1",
    });
    expect(received).toEqual(["org-1"]);
  });

  it("mantém a fila sem broker e recusa o agendamento", async () => {
    const queue = createJobQueue();
    expect(queue.status).toBe("not_configured");
    await expect(queue.enqueue("example", {})).rejects.toThrow(/não está configurada/);
  });

  it("createJobQueueFromEnv permanece not_configured sem flag", () => {
    expect(createJobQueueFromEnv({}).status).toBe("not_configured");
    expect(createJobQueueFromEnv({ LOCAL_QUEUE: "off" }).status).toBe("not_configured");
  });

  it("LocalInProcess enfileira, processa handler e respeita idempotência", async () => {
    const seen: unknown[] = [];
    const queue = new LocalInProcessQueueProvider({
      handlers: {
        demo: async (job) => {
          seen.push(job.payload);
        },
      },
      createId: () => "job-1",
    });
    expect(queue.status).toBe("local_in_process");

    const first = await queue.enqueue("demo", { n: 1 }, { idempotencyKey: "k1" });
    const dup = await queue.enqueue("demo", { n: 2 }, { idempotencyKey: "k1" });
    expect(dup.id).toBe(first.id);
    expect(dup.payload).toEqual({ n: 1 });

    const processed = await queue.processNext();
    expect(processed?.status).toBe("succeeded");
    expect(seen).toEqual([{ n: 1 }]);
    expect(await queue.processNext()).toBeNull();

    const cancelled = await queue.cancel((await queue.enqueue("demo", { n: 3 })).id);
    expect(cancelled?.status).toBe("cancelled");
  });

  it("ativa LocalInProcess via FEATURE_LOCAL_QUEUE ou LOCAL_QUEUE=enabled", async () => {
    const byFeature = createJobQueueFromEnv({ FEATURE_LOCAL_QUEUE: "1" });
    expect(byFeature.status).toBe("local_in_process");
    await expect(byFeature.enqueue("t", {})).resolves.toMatchObject({ status: "queued" });

    const byLocal = createJobQueueFromEnv({ LOCAL_QUEUE: "enabled" });
    expect(byLocal.status).toBe("local_in_process");
  });
});
