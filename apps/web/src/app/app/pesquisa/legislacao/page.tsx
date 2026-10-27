"use client";

import { ResearchCatalogPage } from "../../../../components/research-catalog-page";
import { fetchLegislation } from "../../../../lib/legal-research";

export default function LegislacaoPage() {
  return (
    <ResearchCatalogPage
      title="Legislação"
      description="Normas do catálogo local com URL de proveniência. A verificação da fonte é registrada separadamente da citação."
      sourceType="legislation"
      href="/app/pesquisa/legislacao"
      emptyTitle="Nenhuma legislação no catálogo"
      emptyDescription="Cadastre normas com URL https de proveniência. Nada inventado é listado aqui."
      fetchItems={fetchLegislation}
    />
  );
}
