import { describe, expect, it } from "vitest";
import { AppError } from "@verasjuris/types";
import { assertMatterTransition } from "./matter-state.js";

describe("matter status machine", () => {
  it("permite draft → open", () => {
    expect(() => assertMatterTransition("draft", "open")).not.toThrow();
  });

  it("permite open → active → waiting → closed → archived", () => {
    expect(() => assertMatterTransition("open", "active")).not.toThrow();
    expect(() => assertMatterTransition("active", "waiting")).not.toThrow();
    expect(() => assertMatterTransition("waiting", "closed")).not.toThrow();
    expect(() => assertMatterTransition("closed", "archived")).not.toThrow();
  });

  it("permite restaurar archived → open", () => {
    expect(() => assertMatterTransition("archived", "open")).not.toThrow();
  });

  it("bloqueia draft → closed", () => {
    expect(() => assertMatterTransition("draft", "closed")).toThrow(AppError);
  });

  it("bloqueia archived → closed", () => {
    expect(() => assertMatterTransition("archived", "closed")).toThrow(AppError);
  });
});
