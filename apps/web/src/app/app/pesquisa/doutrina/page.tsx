"use client";

import { ResearchCatalogPage } from "../../../../components/research-catalog-page";
import { fetchDoctrine } from "../../../../lib/legal-research";

export default function DoutrinaPage() {
  return (
    <ResearchCatalogPage
      title="Doutrina"
      description="Referências bibliográficas do catálogo. Sem licença, apenas metadados — nunca texto integral inventado."
      sourceType="doctrine"
      href="/app/pesquisa/doutrina"
      emptyTitle="Nenhuma doutrina no catálogo"
      emptyDescription="Cadastre referências licenciadas ou bibliográficas. Conteúdo integral só aparece quando licenciado."
      fetchItems={fetchDoctrine}
    />
  );
}
