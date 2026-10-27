/**
 * Resolução segura de variáveis de template.
 *
 * Aceita SOMENTE expressões `{{path.to.value}}` com caminhos na whitelist.
 * Sem eval, sem Function, sem acesso arbitrário a propriedades.
 * Bloqueia `__proto__`, `prototype` e `constructor`.
 */

export const MISSING_VARIABLE_STATUS = "missing" as const;

export type MissingVariableMarker = {
  status: typeof MISSING_VARIABLE_STATUS;
  key: string;
};

export function missingVariableMarker(key: string): MissingVariableMarker {
  return { status: MISSING_VARIABLE_STATUS, key };
}

/** Marcador textual inserido no conteúdo renderizado quando a variável falta. */
export function formatMissingVariableMarker(key: string): string {
  return `⟦MISSING_VARIABLE:${key}⟧`;
}

export type TemplateResolveResult = {
  rendered: string;
  missingVariables: string[];
  blockedExpressions: string[];
};

const EXPRESSION_RE = /\{\{\s*([^{}]*?)\s*\}\}/g;

const BLOCKED_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

/** Segmento de caminho: letras/dígitos/_/$ apenas (sem colchetes, sem chamada). */
const PATH_SEGMENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function isBlockedPath(path: string): boolean {
  const segments = path.split(".");
  return segments.some((segment) => BLOCKED_SEGMENTS.has(segment));
}

function isSafePathSyntax(path: string): boolean {
  if (!path || path.length > 200) return false;
  if (path.includes("[") || path.includes("]") || path.includes("(") || path.includes(")")) {
    return false;
  }
  if (/[;`'"]/.test(path) || path.includes(" ") || path.includes("\n")) return false;
  const segments = path.split(".");
  if (segments.length === 0 || segments.length > 12) return false;
  return segments.every((segment) => PATH_SEGMENT_RE.test(segment));
}

function readWhitelistedValue(
  context: Readonly<Record<string, unknown>>,
  path: string,
): { found: true; value: unknown } | { found: false } {
  const segments = path.split(".");
  let current: unknown = context;
  for (const segment of segments) {
    if (BLOCKED_SEGMENTS.has(segment)) return { found: false };
    if (current === null || current === undefined || typeof current !== "object") {
      return { found: false };
    }
    if (Array.isArray(current)) return { found: false };
    if (!Object.hasOwn(current as object, segment)) return { found: false };
    current = (current as Record<string, unknown>)[segment];
  }
  return { found: true, value: current };
}

function stringifyValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "object" && value !== null && "status" in value) {
    const marker = value as MissingVariableMarker;
    if (marker.status === MISSING_VARIABLE_STATUS && typeof marker.key === "string") {
      return formatMissingVariableMarker(marker.key);
    }
  }
  return "";
}

export type TemplateVariableResolverOptions = {
  /** Caminhos permitidos (ex.: `party.name`, `matter.number`). */
  allowedPaths: readonly string[];
};

/**
 * Resolvedor seguro: só substitui `{{path.to.value}}` presentes na whitelist.
 */
export class TemplateVariableResolver {
  private readonly allowed: ReadonlySet<string>;

  constructor(options: TemplateVariableResolverOptions) {
    this.allowed = new Set(options.allowedPaths);
  }

  resolveTemplate(
    content: string,
    context: Readonly<Record<string, unknown>>,
  ): TemplateResolveResult {
    const missingVariables: string[] = [];
    const blockedExpressions: string[] = [];
    const missingSeen = new Set<string>();
    const blockedSeen = new Set<string>();

    const rendered = content.replace(EXPRESSION_RE, (full, rawPath: string) => {
      const path = rawPath.trim();
      if (!isSafePathSyntax(path) || isBlockedPath(path) || !this.allowed.has(path)) {
        if (!blockedSeen.has(full)) {
          blockedSeen.add(full);
          blockedExpressions.push(full);
        }
        return full;
      }
      const read = readWhitelistedValue(context, path);
      if (!read.found) {
        if (!missingSeen.has(path)) {
          missingSeen.add(path);
          missingVariables.push(path);
        }
        const marker = missingVariableMarker(path);
        return formatMissingVariableMarker(marker.key);
      }
      return stringifyValue(read.value);
    });

    return { rendered, missingVariables, blockedExpressions };
  }
}
