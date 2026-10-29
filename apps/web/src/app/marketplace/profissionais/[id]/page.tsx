"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  fetchMarketplaceProfessional,
  formatMoneyCents,
  isApiFailure,
  marketplaceErrorMessage,
  type MarketplaceProfessional,
  type MarketplaceService,
} from "../../../../lib/marketplace";

export default function MarketplaceProfessionalDetailPage() {
  const params = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MarketplaceProfessional | null>(null);
  const [services, setServices] = useState<MarketplaceService[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetchMarketplaceProfessional(params.id).then((data) => {
      if (cancelled) return;
      if (isApiFailure(data)) setError(marketplaceErrorMessage(data));
      else {
        setProfile(data.profile);
        setServices(data.services);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Marketplace", href: "/marketplace" },
          { label: "Profissionais", href: "/marketplace/profissionais" },
          { label: profile?.professionalName ?? "Detalhe" },
        ]}
      />
      {loading ? <LoadingState label="Carregando perfil…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {profile ? (
        <>
          <PageHeader
            title={profile.professionalName ?? "Profissional"}
            description={profile.marketplaceHeadline ?? undefined}
          />
          <p>{profile.marketplaceDescription}</p>
          <h2 className="vj-subtitle">Serviços ativos</h2>
          <ul className="vj-stack">
            {services.map((s) => (
              <li key={s.id} className="vj-card">
                <strong>{s.title}</strong>
                <p className="vj-meta">{s.description}</p>
                {s.basePriceCents != null ? <p>{formatMoneyCents(s.basePriceCents)}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
