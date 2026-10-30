import { describe, expect, it } from "vitest";
import { AppError } from "@verasjuris/types";
import {
  InMemoryWebhookEventIdStore,
  WebhookGateway,
  assertBodySize,
  verifyTimestamp,
} from "./webhook-gateway.js";

describe("WebhookGateway", () => {
  it("rejeita timestamp fora da janela", () => {
    expect(() =>
      verifyTimestamp({ timestampSeconds: 1, nowMs: Date.now(), toleranceSeconds: 60 }),
    ).toThrow(AppError);
  });

  it("bloqueia replay e tamanho", async () => {
    const store = new InMemoryWebhookEventIdStore();
    const gateway = new WebhookGateway({
      allowlist: ["stripe"],
      eventIdStore: store,
      verifier: async () => true,
    });
    gateway.assertProvider("stripe");
    expect(() => gateway.assertProvider("unknown")).toThrow(AppError);
    assertBodySize(10);
    expect(() => assertBodySize(2_000_000)).toThrow(AppError);
    await gateway.assertUniqueEventId("evt_1");
    await expect(gateway.assertUniqueEventId("evt_1")).rejects.toBeInstanceOf(AppError);
    await gateway.verifySignature({
      rawBody: new TextEncoder().encode("{}"),
      signatureHeader: "t=1,v1=abc",
      secret: "sec",
    });
  });

  it("exige verifier real", async () => {
    const gateway = new WebhookGateway({
      allowlist: ["stripe"],
      eventIdStore: new InMemoryWebhookEventIdStore(),
      verifier: null,
    });
    await expect(
      gateway.verifySignature({
        rawBody: new Uint8Array(),
        signatureHeader: "x",
        secret: "y",
      }),
    ).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
  });
});
