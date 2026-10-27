import { describe, expect, it } from "vitest";
import { AppError } from "@verasjuris/types";
import {
  assertLegalDraftTransition,
  assertLegalDraftTransitionGuards,
} from "./legal-draft-state.js";

describe("legal draft state machine", () => {
  it("permite draft → human_review", () => {
    expect(() => assertLegalDraftTransition("draft", "human_review")).not.toThrow();
  });

  it("bloqueia draft → filed", () => {
    expect(() => assertLegalDraftTransition("draft", "filed")).toThrow(AppError);
  });

  it("permite happy path principal", () => {
    expect(() => assertLegalDraftTransition("draft", "human_review")).not.toThrow();
    expect(() => assertLegalDraftTransition("human_review", "approved")).not.toThrow();
    expect(() => assertLegalDraftTransition("approved", "ready_to_file")).not.toThrow();
    expect(() => assertLegalDraftTransition("ready_to_file", "filed")).not.toThrow();
    expect(() => assertLegalDraftTransition("filed", "confirmed")).not.toThrow();
  });

  it("exige aprovador para approved", () => {
    expect(() =>
      assertLegalDraftTransitionGuards("approved", { approvedByMembershipId: null }),
    ).toThrow(AppError);
  });

  it("bloqueia ready_to_file com checklist blocking", () => {
    expect(() =>
      assertLegalDraftTransitionGuards("ready_to_file", {
        hasBlockingChecklistItems: true,
      }),
    ).toThrow(AppError);
  });

  it("exige filedAt e filingMethod para filed", () => {
    expect(() => assertLegalDraftTransitionGuards("filed", { filingMethod: "manual" })).toThrow(
      AppError,
    );
    expect(() =>
      assertLegalDraftTransitionGuards("filed", { filedAt: new Date().toISOString() }),
    ).toThrow(AppError);
  });

  it("exige evidência para confirmed", () => {
    expect(() => assertLegalDraftTransitionGuards("confirmed", {})).toThrow(AppError);
  });
});
