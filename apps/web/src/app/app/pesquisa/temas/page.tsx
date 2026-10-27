"use client";

import { ResearchCatalogPage } from "../../../../components/research-catalog-page";
import { fetchThemes } from "../../../../lib/legal-research";

export default function TemasPage() {
  return (
    <ResearchCatalogPage
      title="Temas"
      description="Temas repetitivos e correlatos cadastrados. Use ‘Gerar citação’ para formatar a referência com status de verificação."
      sourceType="theme"
      href="/app/pesquisa/temas"
      emptyTitle="Nenhum tema no catálogo"
      emptyDescription="O catálogo de temas está vazio. Nenhum tema fictício é sugerido."
      fetchItems={fetchThemes}
    />
  );
}
