/**
 * MarketplaceRankingService — pontuação determinística para busca de profissionais (sem IA, sem lance pago).
 *
 * Critérios (soma em totalScore):
 * - categoryMatch: marketplaceCategories ou serviços ativos na categoria filtrada
 * - areaMatch: practiceAreas contém termos da área jurídica
 * - stateMatch: oabUf, serviceStates ou serviceRegions cobre a UF
 * - cityMatch: serviceCities contém a cidade (quando informada)
 * - remoteAvailable: atende remoto quando remoteAllowed na busca
 * - marketplaceActive: marketplaceStatus === active e marketplaceEnabled
 * - oabVerifiedBonus: oabVerificationStatus === verified
 * - availabilityAvailable: availabilityStatus === available
 * - priceInRange: faixa basePriceMin/Max ou preço de serviço dentro do filtro
 *
 * Ordenação: totalScore desc, professionalProfileId asc (estável).
 */
import type { lawyerProfiles, professionalServices } from "@verasjuris/database";

export type SearchableProfessional = typeof lawyerProfiles.$inferSelect & {
  services?: (typeof professionalServices.$inferSelect)[];
  averageRating?: number | null;
  reviewCount?: number;
};

export type ProfessionalSearchFilters = {
  categoryId?: string;
  legalAreaName?: string | null;
  legalAreaSlug?: string | null;
  locationState?: string;
  locationCity?: string;
  remoteAllowed?: boolean;
  minPriceCents?: number;
  maxPriceCents?: number;
  verifiedOnly?: boolean;
  availabilityOnly?: boolean;
  query?: string;
};

export type ProfessionalScoreBreakdown = Record<string, number>;

export type RankedProfessional = {
  professionalProfileId: string;
  totalScore: number;
  scoreBreakdown: ProfessionalScoreBreakdown;
};

const SCORE = {
  categoryMatch: 40,
  areaMatch: 35,
  stateMatch: 25,
  cityMatch: 15,
  remoteAvailable: 10,
  marketplaceActive: 30,
  oabVerifiedBonus: 8,
  availabilityAvailable: 12,
  priceInRange: 10,
  ratingBonus: 5,
} as const;

function contains(hay: string | null | undefined, needle: string): boolean {
  if (!hay?.trim() || !needle.trim()) return false;
  return hay.toLowerCase().includes(needle.toLowerCase());
}

function stateMatches(lawyer: SearchableProfessional, uf?: string): boolean {
  if (!uf) return true;
  const code = uf.toUpperCase();
  if (lawyer.oabUf?.toUpperCase() === code) return true;
  if (contains(lawyer.serviceStates, code)) return true;
  if (contains(lawyer.serviceRegions, code)) return true;
  return false;
}

function priceMatches(lawyer: SearchableProfessional, filters: ProfessionalSearchFilters): boolean {
  if (filters.minPriceCents === undefined && filters.maxPriceCents === undefined) return true;
  const min = filters.minPriceCents ?? 0;
  const max = filters.maxPriceCents ?? Number.MAX_SAFE_INTEGER;
  const profileMin = lawyer.basePriceMinCents ?? null;
  const profileMax = lawyer.basePriceMaxCents ?? null;
  if (profileMin !== null && profileMin <= max && (profileMax ?? profileMin) >= min) return true;
  for (const svc of lawyer.services ?? []) {
    if (!svc.active) continue;
    const price = svc.basePriceCents ?? svc.minPriceCents ?? svc.maxPriceCents;
    if (price !== null && price !== undefined && price >= min && price <= max) return true;
  }
  return filters.minPriceCents === undefined && filters.maxPriceCents === undefined;
}

function isEligible(lawyer: SearchableProfessional, filters: ProfessionalSearchFilters): boolean {
  if (!lawyer.marketplaceEnabled) return false;
  if (lawyer.marketplaceStatus !== "active") return false;
  if (filters.verifiedOnly && lawyer.oabVerificationStatus !== "verified") return false;
  if (filters.availabilityOnly && lawyer.availabilityStatus !== "available") return false;
  if (filters.locationState && !stateMatches(lawyer, filters.locationState)) return false;
  if (filters.remoteAllowed === true && !lawyer.remoteAvailable) return false;
  if (!priceMatches(lawyer, filters)) return false;
  if (filters.categoryId) {
    const catHit =
      contains(lawyer.marketplaceCategories, filters.categoryId) ||
      (lawyer.services ?? []).some((s) => s.active && s.categoryId === filters.categoryId);
    if (!catHit) return false;
  }
  if (filters.legalAreaName || filters.legalAreaSlug) {
    const areaOk =
      (filters.legalAreaName && contains(lawyer.practiceAreas, filters.legalAreaName)) ||
      (filters.legalAreaSlug && contains(lawyer.practiceAreas, filters.legalAreaSlug));
    if (!areaOk) return false;
  }
  if (filters.query) {
    const q = filters.query;
    const textHit =
      contains(lawyer.professionalName, q) ||
      contains(lawyer.marketplaceHeadline, q) ||
      contains(lawyer.specialties, q) ||
      contains(lawyer.practiceAreas, q);
    if (!textHit) return false;
  }
  return true;
}

export function scoreProfessional(
  lawyer: SearchableProfessional,
  filters: ProfessionalSearchFilters,
): RankedProfessional {
  const breakdown: ProfessionalScoreBreakdown = {};
  let total = 0;

  if (lawyer.marketplaceEnabled && lawyer.marketplaceStatus === "active") {
    breakdown.marketplaceActive = SCORE.marketplaceActive;
    total += SCORE.marketplaceActive;
  }
  if (filters.categoryId) {
    const hit =
      contains(lawyer.marketplaceCategories, filters.categoryId) ||
      (lawyer.services ?? []).some((s) => s.active && s.categoryId === filters.categoryId);
    if (hit) {
      breakdown.categoryMatch = SCORE.categoryMatch;
      total += SCORE.categoryMatch;
    }
  }
  if (filters.legalAreaName && contains(lawyer.practiceAreas, filters.legalAreaName)) {
    breakdown.areaMatch = SCORE.areaMatch;
    total += SCORE.areaMatch;
  } else if (filters.legalAreaSlug && contains(lawyer.practiceAreas, filters.legalAreaSlug)) {
    breakdown.areaMatch = SCORE.areaMatch;
    total += SCORE.areaMatch;
  }
  if (filters.locationState && stateMatches(lawyer, filters.locationState)) {
    breakdown.stateMatch = SCORE.stateMatch;
    total += SCORE.stateMatch;
  }
  if (filters.locationCity && contains(lawyer.serviceCities, filters.locationCity)) {
    breakdown.cityMatch = SCORE.cityMatch;
    total += SCORE.cityMatch;
  }
  if (filters.remoteAllowed && lawyer.remoteAvailable) {
    breakdown.remoteAvailable = SCORE.remoteAvailable;
    total += SCORE.remoteAvailable;
  }
  if (lawyer.oabVerificationStatus === "verified") {
    breakdown.oabVerifiedBonus = SCORE.oabVerifiedBonus;
    total += SCORE.oabVerifiedBonus;
  }
  if (lawyer.availabilityStatus === "available") {
    breakdown.availabilityAvailable = SCORE.availabilityAvailable;
    total += SCORE.availabilityAvailable;
  }
  if (priceMatches(lawyer, filters)) {
    breakdown.priceInRange = SCORE.priceInRange;
    total += SCORE.priceInRange;
  }
  if (lawyer.averageRating && lawyer.averageRating >= 4) {
    breakdown.ratingBonus = SCORE.ratingBonus;
    total += SCORE.ratingBonus;
  }

  return {
    professionalProfileId: lawyer.userId,
    totalScore: total,
    scoreBreakdown: breakdown,
  };
}

export class MarketplaceRankingService {
  rank(
    professionals: SearchableProfessional[],
    filters: ProfessionalSearchFilters,
    limit: number,
  ): RankedProfessional[] {
    const ranked = professionals
      .filter((p) => isEligible(p, filters))
      .map((p) => scoreProfessional(p, filters))
      .sort((a, b) => {
        if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
        return a.professionalProfileId.localeCompare(b.professionalProfileId);
      });
    return ranked.slice(0, limit);
  }
}
