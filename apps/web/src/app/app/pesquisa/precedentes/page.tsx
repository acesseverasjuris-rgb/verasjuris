"use client";

import { ResearchCatalogPage } from "../../../../components/research-catalog-page";
import { fetchPrecedents } from "../../../../lib/legal-research";

export default function PrecedentesPage() {
  return (
    <ResearchCatalogPage
      title="Precedentes"
      description="Precedentes cadastrados com notas de aplicabilidade. A análise de cabimento permanece humana."
      sourceType="precedent"
      href="/app/pesquisa/precedentes"
      emptyTitle="Nenhum precedente no catálogo"
      emptyDescription="Sem registros reais neste momento. Nada é inventado para preenchimento visual."
      fetchItems={fetchPrecedents}
    />
  );
}
