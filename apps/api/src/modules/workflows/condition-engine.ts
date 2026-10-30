/**
 * Safe DSL condition evaluator — NO eval, NO Function(), NO arbitrary SQL.
 */

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "greater_than"
  | "less_than"
  | "exists"
  | "not_exists"
  | "and"
  | "or";

export type ConditionNode = {
  operator: ConditionOperator;
  field?: string;
  value?: unknown;
  children?: ConditionNode[];
};

function getPath(payload: Record<string, unknown>, path: string | undefined): unknown {
  if (!path) return undefined;
  if (!/^[a-zA-Z0-9_.[\]]+$/.test(path)) return undefined;
  const parts = path.split(".");
  let current: unknown = payload;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

export function evaluateCondition(
  node: ConditionNode | null | undefined,
  payload: Record<string, unknown>,
): boolean {
  if (!node) return true;

  switch (node.operator) {
    case "and": {
      const children = node.children ?? [];
      if (children.length === 0) return true;
      return children.every((child) => evaluateCondition(child, payload));
    }
    case "or": {
      const children = node.children ?? [];
      if (children.length === 0) return false;
      return children.some((child) => evaluateCondition(child, payload));
    }
    case "exists":
      return getPath(payload, node.field) !== undefined && getPath(payload, node.field) !== null;
    case "not_exists": {
      const v = getPath(payload, node.field);
      return v === undefined || v === null;
    }
    case "equals":
      return getPath(payload, node.field) === node.value;
    case "not_equals":
      return getPath(payload, node.field) !== node.value;
    case "in": {
      const v = getPath(payload, node.field);
      return Array.isArray(node.value) && node.value.includes(v);
    }
    case "not_in": {
      const v = getPath(payload, node.field);
      return Array.isArray(node.value) && !node.value.includes(v);
    }
    case "greater_than": {
      const left = asNumber(getPath(payload, node.field));
      const right = asNumber(node.value);
      return left !== null && right !== null && left > right;
    }
    case "less_than": {
      const left = asNumber(getPath(payload, node.field));
      const right = asNumber(node.value);
      return left !== null && right !== null && left < right;
    }
    default:
      return false;
  }
}

export function assertSafeConditionTree(node: ConditionNode, depth = 0): void {
  if (depth > 10) {
    throw new Error("Árvore de condições excede profundidade máxima.");
  }
  if (node.field && !/^[a-zA-Z0-9_.[\]]+$/.test(node.field)) {
    throw new Error("fieldPath inválido na condição.");
  }
  for (const child of node.children ?? []) {
    assertSafeConditionTree(child, depth + 1);
  }
}
