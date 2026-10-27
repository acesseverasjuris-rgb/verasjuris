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
  ADMIN_STATUS_LABELS,
  administrativeStatusTone,
  apiErrorMessage,
  bodyLabel,
  fetchAdministrativeProcesses,
  getActiveMembership,
  getActiveOrgId,
  hasAdministrativePermission,
  isApiFailure,
  protocolStatusLabel,
  type AdministrativeProcessSummary,
} from "../../../../../lib/administrative";
import { fetchMatter } from "../../../../../lib/matters";

export default function ProcessosAdministrativosListPage() {
  const params = useParams<{ id: string }>();
  const matterId = params.id;

  const [canRead, setCanRead] = useState(true);
  const [canCreate, setCanCreate] = useState(false);
  const [matterTitle, setMatterTitle] = useState("Caso");
  const [matterRef, setMatterRef] = useState("");
  const [items, setItems] = useState<AdministrativeProcessSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const [matterData, processData] = await Promise.all([
        fetchMatter(orgId, matterId),
        fetchAdministrativeProcesses(orgId, matterId),
      ]);
      if (!isApiFailure(matterData)) {
        setMatterTitle(matterData.matter.title);
        setMatterRef(matterData.matter.internalReference);
      }
      if (isApiFailure(processData)) {
        setError(
          apiErrorMessage(processData, "Não foi possível listar os processos administrativos."),
        );
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
      const readable = hasAdministrativePermission(membership?.permissions, "read");
      setCanRead(readable);
      setCanCreate(hasAdministrativePermission(membership?.permissions, "create"));
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
    { label: "Processos administrativos" },
  ];

  if (!canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <ErrorState title="Sem permissão">
          Você não tem permissão para consultar processos administrativos neste caso.
        </ErrorState>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Processos administrativos"
        eyebrow={matterRef || undefined}
        description={`Processos administrativos vinculados ao caso ${matterTitle}. Cadastro manual — sem integração automática com órgãos.`}
        actions={
          canCreate ? (
            <ButtonLink href={`/app/casos/${matterId}/administrativos/novo`} variant="primary">
              Cadastrar
            </ButtonLink>
          ) : null
        }
      />

      {loading ? <LoadingState label="Carregando processos administrativos" /> : null}
      {error ? <ErrorState title="Erro ao carregar processos">{error}</ErrorState> : null}

      {!loading && !error && items.length === 0 ? (
        <EmptyState
          title="Nenhum processo administrativo cadastrado."
          action={
            canCreate ? (
              <ButtonLink href={`/app/casos/${matterId}/administrativos/novo`} variant="primary">
                Cadastrar
              </ButtonLink>
            ) : null
          }
        >
          Vincule um processo administrativo ao caso informando o órgão, o número e o assunto.
        </EmptyState>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="vj-table-wrap">
          <table className="vj-table">
            <thead>
              <tr>
                <th scope="col">Número</th>
                <th scope="col">Órgão</th>
                <th scope="col">Assunto</th>
                <th scope="col">Situação</th>
                <th scope="col">Protocolo</th>
              </tr>
            </thead>
            <tbody>
              {items.map((process) => {
                const protocolNote = protocolStatusLabel({
                  protocolNumber: process.protocolNumber,
                });
                return (
                  <tr key={process.id}>
                    <td data-label="Número">
                      <a href={`/app/casos/${matterId}/administrativos/${process.id}`}>
                        <span className="vj-technical">{process.number}</span>
                      </a>
                    </td>
                    <td data-label="Órgão">{bodyLabel(process)}</td>
                    <td data-label="Assunto">{process.subject}</td>
                    <td data-label="Situação">
                      <Badge tone={administrativeStatusTone(process.status)}>
                        {ADMIN_STATUS_LABELS[process.status]}
                      </Badge>
                      {process.currentPhase ? (
                        <div className="vj-meta">{process.currentPhase}</div>
                      ) : null}
                    </td>
                    <td data-label="Protocolo">
                      {process.protocolNumber ? (
                        <>
                          <span className="vj-technical">{process.protocolNumber}</span>
                          {protocolNote ? <div className="vj-meta">{protocolNote}</div> : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
