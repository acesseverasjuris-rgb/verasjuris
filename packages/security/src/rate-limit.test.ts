import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "./rate-limit.js";

describe("limite de tentativas", () => {
  it("bloqueia depois do limite e informa a espera", () => {
    const limiter = new MemoryRateLimiter();
    const first = limiter.consume("login:ana", 2, 60_000, 1_000);
    const second = limiter.consume("login:ana", 2, 60_000, 1_100);
    const third = limiter.consume("login:ana", 2, 60_000, 1_200);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("não mistura chaves", () => {
    const limiter = new MemoryRateLimiter();
    limiter.consume("a", 1, 60_000, 1_000);
    expect(limiter.consume("b", 1, 60_000, 1_100).allowed).toBe(true);
    expect(limiter.consume("a", 1, 60_000, 1_100).allowed).toBe(false);
  });
});
