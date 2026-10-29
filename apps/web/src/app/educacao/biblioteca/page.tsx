"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { SectionTabs } from "../../../components/ai-ui";
import { EDUCATION_PUBLIC_TABS, LibraryList } from "../../../components/education-ui";
import {
  educationErrorMessage,
  fetchEducationLibrary,
  isApiFailure,
  type EducationLibraryItem,
} from "../../../lib/education";

export default function EducacaoBibliotecaPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EducationLibraryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchEducationLibrary({ limit: 50 });
      if (cancelled) return;
      if (isApiFailure(res)) setError(educationErrorMessage(res));
      else setItems(res.items);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Educação", href: "/educacao" }, { label: "Biblioteca" }]} />
      <PageHeader title="Biblioteca jurídica" description="Materiais de referência publicados." />
      <SectionTabs label="Seções" items={EDUCATION_PUBLIC_TABS} current="/educacao/biblioteca" />
      {loading ? <LoadingState label="Carregando biblioteca…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <LibraryList items={items} /> : null}
    </div>
  );
}
