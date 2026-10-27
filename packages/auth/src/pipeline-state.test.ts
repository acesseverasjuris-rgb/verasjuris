import { describe, expect, it } from "vitest";
import { AppError } from "@verasjuris/types";
import { assertOpportunityStageTransition, nextActionForStage } from "./pipeline-state.js";

describe("pipeline stage machine", () => {
  it("permite lead → intake", () => {
    expect(() => assertOpportunityStageTransition("lead", "intake")).not.toThrow();
  });

  it("bloqueia lead → proposal", () => {
    expect(() => assertOpportunityStageTransition("lead", "proposal")).toThrow(AppError);
  });

  it("permite contracting → client", () => {
    expect(() => assertOpportunityStageTransition("contracting", "client")).not.toThrow();
  });

  it("sugere iniciar atendimento no stage lead", () => {
    expect(
      nextActionForStage("lead", {
        hasIntake: false,
        hasTriageReady: false,
        hasAnalysisCompleted: false,
        hasProposal: false,
        hasEngagementActive: false,
        hasClient: false,
        hasCase: false,
      }),
    ).toBe("start_intake");
  });
});
