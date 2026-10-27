"use client";

import {
  Badge,
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  apiErrorMessage,
  courtUnitLabel,
  dataSourceLabel,
  fetchJudicialProcesses,
  getActiveMembership,
  getActiveOrgId,
  hasJudicialPermission,
  isApiFailure,
  JUDICIAL_STATUS_LABELS,
  judicialStatusTone,
  type JudicialProcessSummary,
} from "../../../../../lib/judicial";
import { fetchMatter } from "../../../../../lib/matters";

export default function ProcessosJudiciaisListPage() {
  const params = useParams<{ id: string }>();
  const matterId = params.id;

  const [canRead, setCanRead] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [matterTitle, setMatterTitle] = useState<string>("Caso");
  const [matterRef, setMatterRef] = useState<string>("");
  const [items, setItems] = useState<JudicialProcessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const [matterData, processData] = await Promise.all([
        fetchMatter(orgId, matterId),
        fetchJudicialProcesses(orgId, matterId),
      ]);
      if (!isApiFailure(matterData)) {
        setMatterTitle(matterData.matter.title);
        setMatterRef(matterData.matter.internalReference);
      }
      if (isApiFailure(processData)) {
        setError(apiErrorMessage(processData, "Não foi possível listar os processos judiciais."));
        setLoading(false);
        return;
      }
      setItems(processData.items);
      setLoading(false);
    },
    [matterId],
  );

  useEffect(() => {
    void (async () => {
      const [activeId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (!activeId) {
        setError("Nenhuma organização ativa.");
        setLoading(false);
        return;
      }
      const readable = hasJudicialPermission(membership?.permissions, "read");
      setCanRead(readable);
      setCanCreate(hasJudicialPermission(membership?.permissions, "create"));
      if (!readable) {
        setLoading(false);
        return;
      }
      await load(activeId);
    })();
  }, [load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Casos", href: "/app/casos" },
    { label: matterRef || matterTitle, href: `/app/casos/${matterId}` },
    { label: "Processos judiciais" },
  ];

  if (!canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <ErrorState title="Sem permissão">
          Você não tem permissão para consultar processos judiciais neste caso.
        </ErrorState>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Processos judiciais"
        eyebrow={matterRef || undefined}
        description={`Processos vinculados ao caso ${matterTitle}. Cadastro manual — sem captura automática de tribunais.`}
        actions={
          canCreate ? (
            <ButtonLink href={`/app/casos/${matterId}/processos/novo`} variant="primary">
              Cadastrar
            </ButtonLink>
          ) : null
        }
      />

      {loading ? <LoadingState label="Carregando processos judiciais" /> : null}
      {error ? <ErrorState title="Erro ao carregar processos">{error}</ErrorState> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="Nenhum processo judicial foi cadastrado neste caso."
          action={
            canCreate ? (
              <ButtonLink href={`/app/casos/${matterId}/processos/novo`} variant="primary">
                Cadastrar
              </ButtonLink>
            ) : null
          }
        >
          Vincule um processo judicial ao caso informando o número CNJ, o tribunal e os dados
          processuais disponíveis.
        </EmptyState>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="vj-table-wrap">
          <table className="vj-table">
            <thead>
              <tr>
                <th scope="col">CNJ</th>
                <th scope="col">Tribunal / vara</th>
                <th scope="col">Classe</th>
                <th scope="col">Situação</th>
                <th scope="col">Origem</th>
              </tr>
            </thead>
            <tbody>
              {items.map((process) => (
                <tr key={process.id}>
                  <td data-label="CNJ">
                    <a href={`/app/casos/${matterId}/processos/${process.id}`}>
                      <span className="vj-technical">{process.cnjNumber}</span>
                    </a>
                  </td>
                  <td data-label="Tribunal / vara">
                    <div>{process.tribunal?.acronym ?? process.tribunal?.name ?? "—"}</div>
                    <div className="vj-meta">{courtUnitLabel(process)}</div>
                  </td>
                  <td data-label="Classe">{process.proceduralClass?.name ?? "—"}</td>
                  <td data-label="Situação">
                    <Badge tone={judicialStatusTone(process.status)}>
                      {JUDICIAL_STATUS_LABELS[process.status]}
                    </Badge>
                    {process.currentPhase?.name ? (
                      <div className="vj-meta">{process.currentPhase.name}</div>
                    ) : null}
                  </td>
                  <td data-label="Origem">
                    <div>{dataSourceLabel(process.source)}</div>
                    {process.sourceUpdatedAt ? (
                      <div className="vj-meta">
                        Atualizado em {new Date(process.sourceUpdatedAt).toLocaleString("pt-BR")}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
