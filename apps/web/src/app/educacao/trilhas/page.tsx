"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { SectionTabs } from "../../../components/ai-ui";
import { EDUCATION_PUBLIC_TABS, TracksList } from "../../../components/education-ui";
import {
  educationErrorMessage,
  fetchEducationTracks,
  isApiFailure,
  type EducationTrack,
} from "../../../lib/education";

export default function EducacaoTrilhasPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<EducationTrack[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchEducationTracks({ limit: 50 });
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
      <Breadcrumb items={[{ label: "Educação", href: "/educacao" }, { label: "Trilhas" }]} />
      <PageHeader title="Trilhas" description="Percursos guiados de aprendizagem jurídica." />
      <SectionTabs label="Seções" items={EDUCATION_PUBLIC_TABS} current="/educacao/trilhas" />
      {loading ? <LoadingState label="Carregando trilhas…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && !error ? <TracksList items={items} /> : null}
    </div>
  );
}
