"use client";

import {
  Badge,
  Breadcrumb,
  ButtonLink,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  CLIENT_STATUS_LABELS,
  fetchClient,
  fetchClientTimeline,
  getActiveOrgId,
  isApiFailure,
  PERSON_TYPE_LABELS,
  type CrmClientStatus,
  type CrmTag,
  type CrmTimelineItem,
} from "../../../../../lib/crm";

type ClientDetail = {
  id: string;
  personType: "person" | "organization";
  status: CrmClientStatus;
  fullName: string | null;
  socialName: string | null;
  legalName: string | null;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  notes: string | null;
  cpfMasked: string | null;
  cnpjMasked: string | null;
  source: { id: string; name: string } | null;
  channel: { id: string; name: string } | null;
  tags: Array<{ tag: CrmTag } | CrmTag>;
  convertedFromLeadId: string | null;
  createdAt: string;
  updatedAt: string;
};

function displayName(client: ClientDetail): string {
  if (client.personType === "person") {
    return client.socialName || client.fullName || "Sem nome";
  }
  return client.tradeName || client.legalName || "Sem nome";
}

function normalizeTags(tags: ClientDetail["tags"]): CrmTag[] {
  return tags.map((item) => ("tag" in item ? item.tag : item));
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [timeline, setTimeline] = useState<CrmTimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(
    async (activeId: string) => {
      const [clientData, timelineData] = await Promise.all([
        fetchClient(activeId, clientId),
        fetchClientTimeline(activeId, clientId),
      ]);
      if (isApiFailure(clientData)) {
        setError(apiErrorMessage(clientData, "Não foi possível carregar o cliente."));
        setLoading(false);
        return;
      }
      setClient(clientData.client as unknown as ClientDetail);
      if (!isApiFailure(timelineData)) setTimeline(timelineData.items);
      setLoading(false);
    },
    [clientId],
  );

  useEffect(() => {
    void (async () => {
      const activeId = await getActiveOrgId();
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      await reload(activeId);
    })();
  }, [reload]);

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "CRM", href: "/app/crm" },
          { label: "Clientes", href: "/app/crm/clientes" },
          { label: client ? displayName(client) : "Cliente" },
        ]}
      />
      {loading ? <LoadingState label="Carregando cliente" /> : null}
      {error ? <ErrorState title="Erro ao carregar cliente">{error}</ErrorState> : null}
      {client ? (
        <>
          <PageHeader
            title={displayName(client)}
            description={client.notes ?? "Sem observações cadastradas."}
            eyebrow={PERSON_TYPE_LABELS[client.personType]}
            actions={
              client.convertedFromLeadId ? (
                <ButtonLink
                  href={`/app/crm/leads/${client.convertedFromLeadId}`}
                  variant="secondary"
                >
                  Ver lead de origem
                </ButtonLink>
              ) : null
            }
          />
          <div className="vj-split">
            <section className="vj-card vj-stack" aria-labelledby="client-info">
              <h2 id="client-info" className="vj-section-title">
                Informações
              </h2>
              <p>
                <strong>Status:</strong>{" "}
                <Badge tone={client.status === "active" ? "success" : "neutral"}>
                  {CLIENT_STATUS_LABELS[client.status]}
                </Badge>
              </p>
              {client.personType === "person" && client.fullName ? (
                <p>
                  <strong>Nome civil:</strong> {client.fullName}
                </p>
              ) : null}
              {client.personType === "organization" && client.legalName ? (
                <p>
                  <strong>Razão social:</strong> {client.legalName}
                </p>
              ) : null}
              {client.tradeName ? (
                <p>
                  <strong>Nome fantasia:</strong> {client.tradeName}
                </p>
              ) : null}
              <p>
                <strong>E-mail:</strong> {client.email ?? "—"}
              </p>
              <p>
                <strong>Telefone:</strong> {client.phone ?? "—"}
              </p>
              {client.website ? (
                <p>
                  <strong>Site:</strong> {client.website}
                </p>
              ) : null}
              <p>
                <strong>Documento:</strong> {client.cpfMasked ?? client.cnpjMasked ?? "—"}
              </p>
              <p>
                <strong>Origem:</strong> {client.source?.name ?? "—"}
              </p>
              <p>
                <strong>Canal:</strong> {client.channel?.name ?? "—"}
              </p>
              <p className="vj-meta">
                Criado em {new Date(client.createdAt).toLocaleString("pt-BR")} · Atualizado em{" "}
                {new Date(client.updatedAt).toLocaleString("pt-BR")}
              </p>
            </section>
            <section className="vj-card vj-stack" aria-labelledby="client-tags">
              <h2 id="client-tags" className="vj-section-title">
                Tags
              </h2>
              {normalizeTags(client.tags).length === 0 ? (
                <p className="vj-meta">Nenhuma tag associada.</p>
              ) : (
                <ul className="vj-inline-actions">
                  {normalizeTags(client.tags).map((tag) => (
                    <li key={tag.id}>
                      <Badge>{tag.name}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          <section className="vj-card vj-stack" aria-labelledby="client-timeline">
            <h2 id="client-timeline" className="vj-section-title">
              Linha do tempo
            </h2>
            {timeline.length === 0 ? (
              <p className="vj-meta">Interações registradas para este cliente aparecerão aqui.</p>
            ) : (
              <ul className="vj-stack">
                {timeline.map((item) => (
                  <li key={`${item.kind}-${item.id}`}>
                    <strong>{item.title}</strong>
                    <span className="vj-meta">
                      {" "}
                      · {new Date(item.occurredAt).toLocaleString("pt-BR")}
                    </span>
                    {item.body ? <p>{item.body}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
