import type { SessionAccount } from "@verasjuris/auth";
import { AppError } from "@verasjuris/types";

export type AssistantToolName =
  | "searchHelp"
  | "navigateTo"
  | "createSupportRequest"
  | "listMatters"
  | "listDeadlines"
  | "listDocuments";

const CRITICAL_PATTERNS = [
  /\b(pagar|payment|pay)\b/i,
  /\b(protocolar|protocol)\b/i,
  /\b(assinar|sign)\b/i,
  /\b(excluir|delete|apagar)\b/i,
  /\b(aprovar|approve)\b/i,
  /\b(lançar|ledger|lançamento)\b/i,
];

export const ASSISTANT_TOOLS: Record<
  AssistantToolName,
  { description: string; requiresPermission?: string; mutation: boolean }
> = {
  searchHelp: { description: "Busca FAQ/ajuda", mutation: false },
  navigateTo: { description: "Sugere navegação interna", mutation: false },
  createSupportRequest: {
    description: "Cria ticket de suporte (única mutação permitida)",
    mutation: true,
  },
  listMatters: {
    description: "Lista casos com permissão",
    requiresPermission: "matter.read",
    mutation: false,
  },
  listDeadlines: {
    description: "Lista prazos com permissão",
    requiresPermission: "deadline.read",
    mutation: false,
  },
  listDocuments: {
    description: "Lista documentos com permissão",
    requiresPermission: "document.read",
    mutation: false,
  },
};

export function assertNoCriticalAutonomousAction(
  content: string,
  requestCriticalAction: boolean,
): void {
  const hit = CRITICAL_PATTERNS.find((re) => re.test(content));
  if (hit && !requestCriticalAction) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Ação crítica bloqueada. O assistente não executa pagamento, protocolo, assinatura, exclusão, aprovação ou lançamento sem confirmação humana explícita.",
    );
  }
  if (hit && requestCriticalAction) {
    throw new AppError(
      "AUTHORIZATION_ERROR",
      "Ações críticas não são executadas pelo assistente. Abra um ticket de suporte (createSupportRequest).",
    );
  }
}

export function assertToolAllowed(
  account: SessionAccount,
  organizationId: string | null,
  tool: AssistantToolName,
): void {
  const def = ASSISTANT_TOOLS[tool];
  if (!def) throw new AppError("VALIDATION_ERROR", "Ferramenta do assistente desconhecida.");
  if (!def.requiresPermission) return;
  if (!organizationId) {
    throw new AppError("AUTHORIZATION_ERROR", "Ferramenta requer contexto de organização.");
  }
  const membership = account.memberships.find((m) => m.organizationId === organizationId);
  if (!membership?.permissions.includes(def.requiresPermission)) {
    throw new AppError("AUTHORIZATION_ERROR", `Sem permissão para a ferramenta ${tool}.`);
  }
}

export const FAQ_FALLBACK: Record<string, string[]> = {
  "pt-BR": [
    "Como resetar minha senha? Use Conta → Segurança → Redefinir senha.",
    "Onde vejo prazos? Em Prazos, com permissão deadline.read.",
    "Como falar com suporte? Peça createSupportRequest ao assistente.",
  ],
  en: [
    "How do I reset my password? Account → Security → Reset password.",
    "Where are deadlines? Deadlines area (deadline.read).",
    "Need help? Ask the assistant to createSupportRequest.",
  ],
};

export function systemPromptForLocale(locale: string): string {
  const lang = locale.toLowerCase().startsWith("en") ? "en" : "pt-BR";
  if (lang === "en") {
    return "You are VerasJuris assistant. Read/navigate/support only. Never pay, file, sign, delete, approve, or post ledger entries. Create support tickets for mutations.";
  }
  return "Você é o assistente VerasJuris. Apenas leitura/navegação/suporte. Nunca pague, protocole, assine, exclua, aprove ou lance no ledger. Para mutações, crie ticket de suporte.";
}
