import { z } from "zod";

const uuid = z.string().uuid("O identificador não é válido.");

export const PROFESSIONAL_VERIFICATION_TYPES = [
  "oab",
  "cpf",
  "identity",
  "document",
  "biometric",
  "address",
  "other",
] as const;

export const createProfessionalVerificationCaseSchema = z.object({
  verificationType: z.enum(PROFESSIONAL_VERIFICATION_TYPES),
});

export const submitProfessionalCpfSchema = z.object({
  cpf: z.string().min(11, "Informe o CPF.").max(14, "CPF inválido."),
  fullName: z.string().trim().min(2).max(120).optional(),
});

export const submitProfessionalOabSchema = z.object({
  oabNumber: z.string().trim().min(1, "Informe o número da OAB.").max(20),
  oabUf: z
    .string()
    .trim()
    .length(2, "Informe a UF da OAB.")
    .transform((v) => v.toUpperCase()),
});

export const submitProfessionalIdentityDocumentSchema = z.object({
  documentType: z.string().trim().min(1).max(80),
  documentId: uuid,
  number: z.string().trim().max(80).optional(),
  issuingCountry: z.string().trim().length(2).default("BR"),
});

export const recordBiometricConsentSchema = z.object({
  consentTermVersion: z.string().trim().min(1, "Informe a versão do termo de consentimento."),
});

export const professionalVerificationReviewSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  reasonCode: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const createProfessionalSuspensionSchema = z.object({
  professionalProfileId: uuid,
  reason: z.string().trim().min(3, "Informe o motivo.").max(500),
  scope: z
    .enum(["marketplace", "proposals", "acceptance", "engagement", "receiving", "all"])
    .default("all"),
  endsAt: z.string().datetime({ offset: true }).optional(),
});

export const createRevalidationRequestSchema = z.object({
  professionalProfileId: uuid,
  trigger: z.string().trim().min(1).max(120),
  dueAt: z.string().datetime({ offset: true }).optional(),
});
