import { CSRF_HEADER } from "@verasjuris/security/constants";
import type { AiApiFailure } from "./ai";
import { isApiFailure } from "./ai";
import type { Locale } from "./i18n";

export type AssistantMode = "support" | "product" | "legal";

export type AssistantMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
};

export type AssistantConversation = {
  id: string;
  mode: AssistantMode;
  messages: AssistantMessage[];
  aiAvailable?: boolean;
};

const FAQ: Record<Locale, Array<{ q: string; a: string; mode?: AssistantMode }>> = {
  "pt-BR": [
    {
      q: "Como entrar na conta?",
      a: "Use Entrar com e-mail e senha. Se esqueceu a senha, use Recuperar conta.",
      mode: "support",
    },
    {
      q: "Onde fica a acessibilidade?",
      a: "Abra o botão flutuante de acessibilidade ou a página /acessibilidade.",
      mode: "product",
    },
    {
      q: "Vocês são um escritório de advocacia?",
      a: "Não. O VerasJuris é uma plataforma. Este assistente não é advogado e não presta consultoria jurídica.",
      mode: "legal",
    },
    {
      q: "Como ver o status do sistema?",
      a: "Consulte a página pública /status.",
      mode: "support",
    },
    {
      q: "Onde estão as políticas?",
      a: "No rodapé institucional e em /politicas/* (conteúdo DRAFT até aprovação).",
      mode: "product",
    },
  ],
  "en-US": [
    {
      q: "How do I sign in?",
      a: "Use Sign in with email and password. Use account recovery if needed.",
      mode: "support",
    },
    {
      q: "Where is accessibility?",
      a: "Open the floating accessibility button or /acessibilidade.",
      mode: "product",
    },
    {
      q: "Are you a law firm?",
      a: "No. VerasJuris is a platform. This assistant is not a lawyer and does not give legal advice.",
      mode: "legal",
    },
    {
      q: "System status?",
      a: "See the public /status page.",
      mode: "support",
    },
  ],
  "es-ES": [
    {
      q: "¿Cómo inicio sesión?",
      a: "Use Entrar con correo y contraseña. Si olvidó la contraseña, recupere la cuenta.",
      mode: "support",
    },
    {
      q: "¿Dónde está la accesibilidad?",
      a: "Abra el botón flotante de accesibilidad o /acessibilidade.",
      mode: "product",
    },
    {
      q: "¿Son un bufete?",
      a: "No. VerasJuris es una plataforma. Este asistente no es abogado y no da asesoría jurídica.",
      mode: "legal",
    },
  ],
};

export function faqFor(locale: Locale, mode: AssistantMode): Array<{ q: string; a: string }> {
  return FAQ[locale]
    .filter((item) => !item.mode || item.mode === mode)
    .concat(FAQ[locale].filter((item) => item.mode && item.mode !== mode).slice(0, 2));
}

export function matchFaq(locale: Locale, mode: AssistantMode, question: string): string | null {
  const q = question.trim().toLowerCase();
  if (!q) return null;
  const entries = FAQ[locale];
  const hit =
    entries.find(
      (item) => (!item.mode || item.mode === mode) && item.q.toLowerCase().includes(q),
    ) ??
    entries.find(
      (item) => item.a.toLowerCase().includes(q) || q.includes(item.q.toLowerCase().slice(0, 12)),
    );
  if (hit) return hit.a;
  if (mode === "legal" || /advogad|lawyer|abogad|consultoria|parecer/i.test(q)) {
    return FAQ[locale].find((item) => item.mode === "legal")?.a ?? null;
  }
  return null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T | AiApiFailure> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { "content-type": "application/json" } : {}),
        ...(init?.method && init.method !== "GET" ? { [CSRF_HEADER]: "1" } : {}),
        ...init?.headers,
      },
      cache: "no-store",
    });
  } catch {
    return { httpStatus: 0, error: { code: "network", message: "Falha de rede." } };
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as AiApiFailure;
    return { httpStatus: response.status, ...body };
  }
  if (response.status === 204) return {} as T;
  return (await response.json()) as T;
}

export async function sendAssistantMessage(input: {
  mode: AssistantMode;
  message: string;
  conversationId?: string | null;
  locale: Locale;
  path?: string;
}): Promise<
  | {
      conversationId: string;
      reply: string;
      aiAvailable: boolean;
      messages?: AssistantMessage[];
    }
  | AiApiFailure
> {
  const res = await request<{
    conversationId: string;
    reply: string;
    aiAvailable: boolean;
    messages?: AssistantMessage[];
  }>("/api/v1/assistant/messages", {
    method: "POST",
    body: JSON.stringify({
      mode: input.mode,
      message: input.message,
      conversationId: input.conversationId ?? undefined,
      locale: input.locale,
      path: input.path,
    }),
  });
  if (isApiFailure(res)) return res;
  return res;
}

export function localFallbackReply(locale: Locale, mode: AssistantMode, question: string): string {
  const faq = matchFaq(locale, mode, question);
  if (faq) return faq;
  const disclaimers: Record<Locale, string> = {
    "pt-BR":
      "Não encontrei uma resposta no FAQ. Consulte a Central de Ajuda ou o suporte. Lembrete: não sou advogado.",
    "en-US": "No FAQ match. Check Help Center or support. Reminder: I am not a lawyer.",
    "es-ES":
      "No hay coincidencia en el FAQ. Consulte Ayuda o soporte. Recordatorio: no soy abogado.",
  };
  return disclaimers[locale];
}
