import { describe, expect, it } from "vitest";
import {
  InMemoryWebhookEventIdStore,
  WebhookGateway,
  assertProviderAllowed,
  verifyTimestamp,
} from "@verasjuris/ai";
import { AppError } from "@verasjuris/types";

describe("webhooks gateway helpers", () => {
  it("allowlist + replay + signature verifier required", async () => {
    expect(() => assertProviderAllowed("x", ["stripe"])).toThrow(AppError);
    const store = new InMemoryWebhookEventIdStore();
    const gateway = new WebhookGateway({
      allowlist: ["stripe"],
      eventIdStore: store,
      verifier: async ({ signatureHeader }) => signatureHeader === "valid",
    });
    gateway.verifyTimestamp(Math.floor(Date.now() / 1000));
    expect(() => verifyTimestamp({ timestampSeconds: 1, nowMs: Date.now() })).toThrow(AppError);
    await gateway.assertUniqueEventId("e1");
    await expect(gateway.assertUniqueEventId("e1")).rejects.toBeInstanceOf(AppError);
    await expect(
      gateway.verifySignature({
        rawBody: new Uint8Array([1]),
        signatureHeader: "invalid",
        secret: "s",
      }),
    ).rejects.toBeInstanceOf(AppError);
    await gateway.verifySignature({
      rawBody: new Uint8Array([1]),
      signatureHeader: "valid",
      secret: "s",
    });
  });
});
