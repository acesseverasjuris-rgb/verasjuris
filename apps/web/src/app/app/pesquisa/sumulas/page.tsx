"use client";

import { ResearchCatalogPage } from "../../../../components/research-catalog-page";
import { fetchSummaries } from "../../../../lib/legal-research";

export default function SumulasPage() {
  return (
    <ResearchCatalogPage
      title="Súmulas"
      description="Súmulas do catálogo. O selo de verificação indica disponibilidade da fonte — nunca ‘oficial’ sem prova."
      sourceType="summary"
      href="/app/pesquisa/sumulas"
      emptyTitle="Nenhuma súmula no catálogo"
      emptyDescription="Quando houver registros reais, eles aparecerão aqui."
      fetchItems={fetchSummaries}
    />
  );
}
