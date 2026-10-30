export type MetricUnit = "cents" | "count" | "ratio" | "percent" | "score" | "days";

export type MetricDefinition = {
  key: string;
  name: string;
  description: string;
  domain: string;
  unit: MetricUnit;
  formulaVersion: string;
  sourceDomains: readonly string[];
  dimensions: readonly string[];
  aggregation: "sum" | "avg" | "count" | "ratio" | "last";
  freshness: "realtime" | "hourly" | "daily" | "on_demand";
  owner: string;
};

export const METRIC_DEFINITIONS: readonly MetricDefinition[] = [
  {
    key: "revenue",
    name: "Receita",
    description: "Soma de faturas pagas no período (centavos).",
    domain: "revenue",
    unit: "cents",
    formulaVersion: "revenue.v1",
    sourceDomains: ["finance"],
    dimensions: ["organizationId", "product", "plan"],
    aggregation: "sum",
    freshness: "daily",
    owner: "finance",
  },
  {
    key: "mrr",
    name: "MRR",
    description:
      "Monthly Recurring Revenue: soma priceCents de assinaturas active cujo billingInterval ≠ one_time. Normaliza yearly→/12, quarterly→/3.",
    domain: "subscription",
    unit: "cents",
    formulaVersion: "mrr.v1",
    sourceDomains: ["finance"],
    dimensions: ["organizationId", "plan"],
    aggregation: "sum",
    freshness: "daily",
    owner: "finance",
  },
  {
    key: "arr",
    name: "ARR",
    description: "Annual run-rate = MRR * 12 (formulaVersion arr.v1).",
    domain: "subscription",
    unit: "cents",
    formulaVersion: "arr.v1",
    sourceDomains: ["finance"],
    dimensions: ["organizationId", "plan"],
    aggregation: "sum",
    freshness: "daily",
    owner: "finance",
  },
  {
    key: "logo_churn",
    name: "Logo churn",
    description:
      "Clientes cancelados no período / clientes ativos no início (logo_churn.v1). INSUFFICIENT_DATA se base=0.",
    domain: "subscription",
    unit: "ratio",
    formulaVersion: "logo_churn.v1",
    sourceDomains: ["finance"],
    dimensions: ["organizationId"],
    aggregation: "ratio",
    freshness: "daily",
    owner: "finance",
  },
  {
    key: "revenue_churn",
    name: "Revenue churn",
    description:
      "MRR perdido por cancelamento / MRR início do período (revenue_churn.v1). INSUFFICIENT_DATA se base=0.",
    domain: "subscription",
    unit: "ratio",
    formulaVersion: "revenue_churn.v1",
    sourceDomains: ["finance"],
    dimensions: ["organizationId"],
    aggregation: "ratio",
    freshness: "daily",
    owner: "finance",
  },
  {
    key: "cac",
    name: "CAC",
    description:
      "Custo de aquisição / novos clientes. Retorna INSUFFICIENT_DATA sem dados de aquisição.",
    domain: "finance",
    unit: "cents",
    formulaVersion: "cac.v1",
    sourceDomains: ["finance", "crm"],
    dimensions: ["organizationId", "channel"],
    aggregation: "ratio",
    freshness: "on_demand",
    owner: "finance",
  },
  {
    key: "ltv",
    name: "LTV",
    description:
      "Lifetime value estimado. Retorna INSUFFICIENT_DATA sem histórico suficiente de receita/cliente.",
    domain: "finance",
    unit: "cents",
    formulaVersion: "ltv.v1",
    sourceDomains: ["finance"],
    dimensions: ["organizationId", "plan"],
    aggregation: "avg",
    freshness: "on_demand",
    owner: "finance",
  },
  {
    key: "conversions",
    name: "Conversões",
    description: "Oportunidades ganhas / total no funil no período.",
    domain: "conversion",
    unit: "ratio",
    formulaVersion: "conversions.v1",
    sourceDomains: ["pipeline"],
    dimensions: ["organizationId", "area"],
    aggregation: "ratio",
    freshness: "daily",
    owner: "crm",
  },
  {
    key: "processes",
    name: "Processos",
    description: "Contagem de processos judiciais/administrativos ativos.",
    domain: "legal",
    unit: "count",
    formulaVersion: "processes.v1",
    sourceDomains: ["judicial", "administrative"],
    dimensions: ["organizationId", "area"],
    aggregation: "count",
    freshness: "hourly",
    owner: "legal",
  },
  {
    key: "deadlines",
    name: "Prazos",
    description: "Prazos confirmados com vencimento no período.",
    domain: "deadline",
    unit: "count",
    formulaVersion: "deadlines.v1",
    sourceDomains: ["productivity"],
    dimensions: ["organizationId"],
    aggregation: "count",
    freshness: "hourly",
    owner: "operations",
  },
  {
    key: "productivity",
    name: "Produtividade",
    description: "Tarefas concluídas no período.",
    domain: "productivity",
    unit: "count",
    formulaVersion: "productivity.v1",
    sourceDomains: ["productivity"],
    dimensions: ["organizationId", "member"],
    aggregation: "count",
    freshness: "hourly",
    owner: "operations",
  },
  {
    key: "ai",
    name: "Uso de IA",
    description: "Jobs de IA concluídos (nunca inventa tokens/custo).",
    domain: "ai",
    unit: "count",
    formulaVersion: "ai.v1",
    sourceDomains: ["ai"],
    dimensions: ["organizationId", "feature"],
    aggregation: "count",
    freshness: "daily",
    owner: "product",
  },
  {
    key: "costs",
    name: "Custos",
    description: "Soma de cost_records.amountCents no período.",
    domain: "cost",
    unit: "cents",
    formulaVersion: "costs.v1",
    sourceDomains: ["finance"],
    dimensions: ["organizationId", "category", "costCenter"],
    aggregation: "sum",
    freshness: "daily",
    owner: "finance",
  },
  {
    key: "marketplace",
    name: "Marketplace",
    description: "Engajamentos concluídos no marketplace.",
    domain: "marketplace",
    unit: "count",
    formulaVersion: "marketplace.v1",
    sourceDomains: ["marketplace"],
    dimensions: ["organizationId"],
    aggregation: "count",
    freshness: "daily",
    owner: "marketplace",
  },
  {
    key: "finance",
    name: "Financeiro (saldo operacional)",
    description: "Receita paga − custos no período (centavos).",
    domain: "finance",
    unit: "cents",
    formulaVersion: "finance_net.v1",
    sourceDomains: ["finance"],
    dimensions: ["organizationId"],
    aggregation: "sum",
    freshness: "daily",
    owner: "finance",
  },
  {
    key: "legal",
    name: "Casos jurídicos",
    description: "Casos (legal_matters) abertos/ativos no período.",
    domain: "legal",
    unit: "count",
    formulaVersion: "legal.v1",
    sourceDomains: ["matters"],
    dimensions: ["organizationId", "area"],
    aggregation: "count",
    freshness: "hourly",
    owner: "legal",
  },
] as const;

export class MetricRegistry {
  private readonly byKey = new Map(METRIC_DEFINITIONS.map((m) => [m.key, m]));

  list(filter?: { domain?: string; q?: string }) {
    let items = [...METRIC_DEFINITIONS];
    if (filter?.domain) items = items.filter((m) => m.domain === filter.domain);
    if (filter?.q) {
      const q = filter.q.toLowerCase();
      items = items.filter(
        (m) =>
          m.key.includes(q) ||
          m.name.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q),
      );
    }
    return items;
  }

  get(key: string): MetricDefinition | undefined {
    return this.byKey.get(key);
  }

  require(key: string): MetricDefinition {
    const def = this.get(key);
    if (!def) {
      throw Object.assign(new Error(`Métrica desconhecida: ${key}`), {
        code: "NOT_FOUND",
      });
    }
    return def;
  }
}

export const defaultMetricRegistry = new MetricRegistry();
