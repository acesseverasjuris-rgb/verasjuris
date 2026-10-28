/**
 * OnlineLawyerMatchingService — ranqueamento determinístico (sem IA, sem aleatoriedade, sem lance pago).
 *
 * Critérios de pontuação (soma em totalScore):
 * - areaMatch: practiceAreas contém nome ou slug da área jurídica da solicitação
 * - stateMatch: oabUf ou serviceStates cobre a UF da solicitação
 * - onlineServiceEnabled: advogado com atendimento online habilitado
 * - availabilityAvailable: availabilityStatus === available
 * - acceptsUrgent: quando urgency é high/urgent e advogado aceita urgência
 * - preferredMode: modo preferido da solicitação aparece em consultationModes
 * - oabVerifiedBonus: oabVerificationStatus === verified (informed permanece elegível)
 *
 * Ordenação: totalScore desc, lawyerProfileId asc (estável).
 * Candidatos gerados entram como status offered com expiresAt configurável (padrão now+30min).
 */
import type { lawyerProfiles } from "@verasjuris/database";

export type MatchableRequest = {
  stateCode: string;
  urgency: "low" | "normal" | "high" | "urgent";
  preferredMode: "text" | "audio" | "video" | "in_person" | "other";
  legalAreaName?: string | null;
  legalAreaSlug?: string | null;
};

export type MatchableLawyer = typeof lawyerProfiles.$inferSelect;

export type ScoreBreakdown = Record<string, number>;

export type RankedLawyerMatch = {
  lawyerProfileId: string;
  totalScore: number;
  scoreBreakdown: ScoreBreakdown;
};

const SCORE = {
  areaMatch: 50,
  stateMatch: 30,
  onlineServiceEnabled: 20,
  availabilityAvailable: 15,
  acceptsUrgent: 10,
  preferredMode: 10,
  oabVerifiedBonus: 5,
} as const;

function textContains(haystack: string | null | undefined, needle: string): boolean {
  if (!haystack?.trim() || !needle.trim()) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function stateMatches(lawyer: MatchableLawyer, stateCode: string): boolean {
  const uf = stateCode.toUpperCase();
  if (lawyer.oabUf?.toUpperCase() === uf) return true;
  if (textContains(lawyer.serviceStates, uf)) return true;
  if (textContains(lawyer.serviceRegions, uf)) return true;
  return false;
}

function modeMatches(lawyer: MatchableLawyer, mode: MatchableRequest["preferredMode"]): boolean {
  if (!lawyer.consultationModes?.trim()) return mode === "text";
  return textContains(lawyer.consultationModes, mode);
}

function isEligible(lawyer: MatchableLawyer, request: MatchableRequest): boolean {
  if (!lawyer.onlineServiceEnabled) return false;
  if (lawyer.availabilityStatus !== "available") return false;
  if (!stateMatches(lawyer, request.stateCode)) return false;
  if (request.urgency === "high" || request.urgency === "urgent") {
    if (!lawyer.acceptsUrgent) return false;
  }
  if (request.legalAreaName || request.legalAreaSlug) {
    const areaOk =
      (request.legalAreaName && textContains(lawyer.practiceAreas, request.legalAreaName)) ||
      (request.legalAreaSlug && textContains(lawyer.practiceAreas, request.legalAreaSlug));
    if (!areaOk) return false;
  }
  return true;
}

export function scoreLawyerForRequest(
  lawyer: MatchableLawyer,
  request: MatchableRequest,
): RankedLawyerMatch | null {
  if (!isEligible(lawyer, request)) return null;

  const breakdown: ScoreBreakdown = {};
  let totalScore = 0;

  const areaMatched =
    (request.legalAreaName && textContains(lawyer.practiceAreas, request.legalAreaName)) ||
    (request.legalAreaSlug && textContains(lawyer.practiceAreas, request.legalAreaSlug));
  if (areaMatched) {
    breakdown.areaMatch = SCORE.areaMatch;
    totalScore += SCORE.areaMatch;
  }
  if (stateMatches(lawyer, request.stateCode)) {
    breakdown.stateMatch = SCORE.stateMatch;
    totalScore += SCORE.stateMatch;
  }
  if (lawyer.onlineServiceEnabled) {
    breakdown.onlineServiceEnabled = SCORE.onlineServiceEnabled;
    totalScore += SCORE.onlineServiceEnabled;
  }
  if (lawyer.availabilityStatus === "available") {
    breakdown.availabilityAvailable = SCORE.availabilityAvailable;
    totalScore += SCORE.availabilityAvailable;
  }
  if ((request.urgency === "high" || request.urgency === "urgent") && lawyer.acceptsUrgent) {
    breakdown.acceptsUrgent = SCORE.acceptsUrgent;
    totalScore += SCORE.acceptsUrgent;
  }
  if (modeMatches(lawyer, request.preferredMode)) {
    breakdown.preferredMode = SCORE.preferredMode;
    totalScore += SCORE.preferredMode;
  }
  if (lawyer.oabVerificationStatus === "verified") {
    breakdown.oabVerifiedBonus = SCORE.oabVerifiedBonus;
    totalScore += SCORE.oabVerifiedBonus;
  }

  return {
    lawyerProfileId: lawyer.userId,
    totalScore,
    scoreBreakdown: breakdown,
  };
}

export class OnlineLawyerMatchingService {
  rank(lawyers: MatchableLawyer[], request: MatchableRequest, limit: number): RankedLawyerMatch[] {
    const ranked = lawyers
      .map((lawyer) => scoreLawyerForRequest(lawyer, request))
      .filter((item): item is RankedLawyerMatch => item !== null)
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return a.lawyerProfileId.localeCompare(b.lawyerProfileId);
      });
    return ranked.slice(0, limit);
  }
}
