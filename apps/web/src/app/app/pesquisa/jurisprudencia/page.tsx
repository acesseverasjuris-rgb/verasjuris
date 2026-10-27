"use client";

import { ResearchCatalogPage } from "../../../../components/research-catalog-page";
import { fetchCaseLaw } from "../../../../lib/legal-research";

export default function JurisprudenciaPage() {
  return (
    <ResearchCatalogPage
      title="Jurisprudência"
      description="Decisões cadastradas no catálogo local. Gere citações com selo de verificação — não trate como fonte oficial sem comprovação."
      sourceType="case_law"
      href="/app/pesquisa/jurisprudencia"
      emptyTitle="Nenhuma jurisprudência no catálogo"
      emptyDescription="O catálogo está vazio para esta organização. Nenhum acórdão de exemplo é exibido."
      fetchItems={fetchCaseLaw}
      showCourtFilter
    />
  );
}
