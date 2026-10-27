/**
 * Saída de modelo NUNCA é confiável. Antes de persistir ou devolver texto vindo de IA, removemos
 * marcação HTML/script e esquemas de URL perigosos. O texto resultante é puro (text/plain): clientes
 * devem renderizá-lo como texto, nunca como HTML.
 */

const REMOVED_PLACEHOLDER = "[conteúdo removido]";

const BLOCK_TAGS =
  /<\s*(script|style|iframe|object|embed|svg|math|template)\b[\s\S]*?<\s*\/\s*\1\s*>/gi;
const OPEN_BLOCK_TAGS = /<\s*(script|style|iframe|object|embed|svg|math|template)\b[^>]*>?/gi;
const COMMENTS = /<!--[\s\S]*?-->/g;
const ANY_TAG = /<\s*\/?\s*[a-zA-Z!?][^>]*>/g;
const DANGEROUS_SCHEMES = /\b(?:javascript|vbscript)\s*:|data\s*:\s*text\/html/gi;
// biome-ignore lint/suspicious/noControlCharactersInRegex: remoção intencional de controles.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitizeAiText(input: string): string {
  let current = input;
  for (let pass = 0; pass < 5; pass += 1) {
    const next = current
      .replace(COMMENTS, "")
      .replace(BLOCK_TAGS, "")
      .replace(OPEN_BLOCK_TAGS, "")
      .replace(ANY_TAG, "")
      .replace(DANGEROUS_SCHEMES, "")
      .replace(CONTROL_CHARS, "");
    if (next === current) break;
    current = next;
  }
  const trimmed = current.trim();
  if (trimmed.length === 0 && input.trim().length > 0) return REMOVED_PLACEHOLDER;
  return trimmed;
}

/** Sanitiza recursivamente todas as strings de uma estrutura JSON. */
export function sanitizeAiOutput<T>(value: T): T {
  if (typeof value === "string") return sanitizeAiText(value) as T;
  if (Array.isArray(value)) return value.map((item) => sanitizeAiOutput(item)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeAiOutput(item);
    }
    return out as T;
  }
  return value;
}
