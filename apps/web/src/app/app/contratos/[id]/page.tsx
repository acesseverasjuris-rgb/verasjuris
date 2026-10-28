"use client";

import {
  Breadcrumb,
  ButtonLink,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  CONTRATO_TABS,
  ContractApprovalsList,
  ContractClausesList,
  ContractPartiesList,
  ContractSectionNav,
  ContractSummaryCard,
  ContractVersionsList,
  SignatureProviderBanner,
  SignatureRequestsList,
} from "../../../../components/contracts-ui";
import {
  contractErrorMessage,
  fetchContract,
  fetchContractApprovals,
  fetchContractClauses,
  fetchContractObligations,
  fetchContractParties,
  fetchContractRenewals,
  fetchContractTerminations,
  fetchContractTimeline,
  fetchContractVersions,
  fetchSignatureProvidersStatus,
  fetchSignatureRequests,
  formatDateTime,
  hasContractPermission,
  isApiFailure,
  isSignatureProviderNotConfigured,
  type Contract,
  type ContractApproval,
  type ContractClauseInstance,
  type ContractObligation,
  type ContractParty,
  type ContractRenewal,
  type ContractTermination,
  type ContractTimelineItem,
  type ContractVersion,
  type SignatureRequest,
} from "../../../../lib/contracts";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function ContratoDetailPage() {
  const params = useParams<{ id: string }>();
  const contractId = params.id;
  const org = useOrgContext();
  const canRead = hasContractPermission(org.permissions, "read");

  const [contract, setContract] = useState<Contract | null>(null);
  const [versions, setVersions] = useState<ContractVersion[]>([]);
  const [parties, setParties] = useState<ContractParty[]>([]);
  const [clauses, setClauses] = useState<ContractClauseInstance[]>([]);
  const [approvals, setApprovals] = useState<ContractApproval[]>([]);
  const [signatures, setSignatures] = useState<SignatureRequest[]>([]);
  const [obligations, setObligations] = useState<ContractObligation[]>([]);
  const [renewals, setRenewals] = useState<ContractRenewal[]>([]);
  const [terminations, setTerminations] = useState<ContractTermination[]>([]);
  const [timeline, setTimeline] = useState<ContractTimelineItem[]>([]);
  const [notConfigured, setNotConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const [provider, detail, vers, parts, cls, appr, sigs, obl, ren, term, tl] =
        await Promise.all([
          fetchSignatureProvidersStatus(orgId),
          fetchContract(orgId, contractId),
          fetchContractVersions(orgId, contractId),
          fetchContractParties(orgId, contractId),
          fetchContractClauses(orgId, contractId),
          fetchContractApprovals(orgId, contractId),
          fetchSignatureRequests(orgId, contractId),
          fetchContractObligations(orgId, contractId),
          fetchContractRenewals(orgId, contractId),
          fetchContractTerminations(orgId, contractId),
          fetchContractTimeline(orgId, contractId),
        ]);

      setNotConfigured(isSignatureProviderNotConfigured(provider));
      if (isApiFailure(detail)) {
        setError(contractErrorMessage(detail, "Não foi possível carregar o contrato."));
        setContract(null);
      } else {
        setContract(detail.contract);
      }
      setVersions(isApiFailure(vers) ? [] : vers.items);
      setParties(isApiFailure(parts) ? [] : parts.items);
      setClauses(isApiFailure(cls) ? [] : cls.items);
      setApprovals(isApiFailure(appr) ? [] : appr.items);
      setSignatures(isApiFailure(sigs) ? [] : sigs.items);
      setObligations(isApiFailure(obl) ? [] : obl.items);
      setRenewals(isApiFailure(ren) ? [] : ren.items);
      setTerminations(isApiFailure(term) ? [] : term.items);
      setTimeline(isApiFailure(tl) ? [] : tl.items);
      setLoading(false);
    },
    [contractId],
  );

  useEffect(() => {
    if (!org.ready) return;
    if (!org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void load(org.orgId);
  }, [org.ready, org.orgId, canRead, load]);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Contratos", href: "/app/contratos" },
    { label: "Detalhe" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar este contrato.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={contract?.title ?? "Contrato"}
        description="Versões imutáveis após assinatura — revisão humana em aprovações."
      />
      <SectionTabs label="Seções de contratos" items={CONTRATO_TABS} current="/app/contratos" />
      <SignatureProviderBanner notConfigured={notConfigured} />
      <ContractSectionNav />

      {loading || !org.ready ? <LoadingState label="Carregando contrato" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}

      {contract ? (
        <>
          <ContractSummaryCard contract={contract} />

          <section id="versoes" className="vj-stack" aria-labelledby="ctr-ver">
            <h2 id="ctr-ver" className="vj-section-title">
              Versões
            </h2>
            {versions.length === 0 ? (
              <EmptyState title="Sem versões">Nenhuma versão registrada.</EmptyState>
            ) : null}
            <ContractVersionsList items={versions} />
          </section>

          <section id="partes" className="vj-stack" aria-labelledby="ctr-partes">
            <h2 id="ctr-partes" className="vj-section-title">
              Partes
            </h2>
            {parties.length === 0 ? (
              <EmptyState title="Sem partes">Cadastre partes do contrato.</EmptyState>
            ) : null}
            <ContractPartiesList items={parties} />
          </section>

          <section id="clausulas" className="vj-stack" aria-labelledby="ctr-cl">
            <h2 id="ctr-cl" className="vj-section-title">
              Cláusulas
            </h2>
            {clauses.length === 0 ? (
              <EmptyState title="Sem cláusulas">Nenhuma cláusula instanciada.</EmptyState>
            ) : null}
            <ContractClausesList items={clauses} />
          </section>

          <section id="aprovacoes" className="vj-stack" aria-labelledby="ctr-apr">
            <h2 id="ctr-apr" className="vj-section-title">
              Aprovações
            </h2>
            {approvals.length === 0 ? (
              <EmptyState title="Sem aprovações">Nenhum fluxo de aprovação.</EmptyState>
            ) : null}
            <ContractApprovalsList items={approvals} />
          </section>

          <section id="assinaturas" className="vj-stack" aria-labelledby="ctr-sign">
            <h2 id="ctr-sign" className="vj-section-title">
              Assinaturas
            </h2>
            {signatures.length === 0 ? (
              <EmptyState title="Sem solicitações">
                Provedor eletrônico indisponível — use{" "}
                <a href="/app/contratos/assinaturas">registro manual</a>.
              </EmptyState>
            ) : null}
            <SignatureRequestsList items={signatures} />
          </section>

          <section id="obrigacoes" className="vj-stack" aria-labelledby="ctr-obl">
            <h2 id="ctr-obl" className="vj-section-title">
              Obrigações
            </h2>
            {obligations.length === 0 ? (
              <EmptyState title="Sem obrigações">Nenhuma obrigação contratual.</EmptyState>
            ) : null}
            <ul className="vj-stack">
              {obligations.map((o) => (
                <li key={o.id} className="vj-card">
                  {o.title}
                  {o.dueDate ? (
                    <span className="vj-meta"> · {formatDateTime(o.dueDate)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section id="documentos" className="vj-card vj-stack" aria-labelledby="ctr-doc">
            <h2 id="ctr-doc" className="vj-section-title">
              Documentos
            </h2>
            <ButtonLink href="/app/documentos" variant="secondary">
              Repositório de documentos
            </ButtonLink>
          </section>

          <section id="renovacoes" className="vj-stack" aria-labelledby="ctr-ren">
            <h2 id="ctr-ren" className="vj-section-title">
              Renovações
            </h2>
            {renewals.length === 0 ? (
              <EmptyState title="Sem renovações">Nenhuma renovação registrada.</EmptyState>
            ) : null}
            <ul className="vj-stack">
              {renewals.map((r) => (
                <li key={r.id} className="vj-card">
                  {r.status}
                </li>
              ))}
            </ul>
          </section>

          <section id="rescisao" className="vj-stack" aria-labelledby="ctr-term">
            <h2 id="ctr-term" className="vj-section-title">
              Rescisão
            </h2>
            {terminations.length === 0 ? (
              <EmptyState title="Sem rescisão">Contrato não rescindido.</EmptyState>
            ) : null}
            <ul className="vj-stack">
              {terminations.map((t) => (
                <li key={t.id} className="vj-card">
                  {t.status}
                </li>
              ))}
            </ul>
          </section>

          <section id="prazos" className="vj-card vj-stack" aria-labelledby="ctr-prazos">
            <h2 id="ctr-prazos" className="vj-section-title">
              Prazos
            </h2>
            <ButtonLink href="/app/prazos" variant="secondary">
              Abrir prazos
            </ButtonLink>
          </section>

          <section id="tarefas" className="vj-card vj-stack" aria-labelledby="ctr-tarefas">
            <h2 id="ctr-tarefas" className="vj-section-title">
              Tarefas
            </h2>
            <ButtonLink href="/app/tarefas" variant="secondary">
              Abrir tarefas
            </ButtonLink>
          </section>

          <section id="historico" className="vj-stack" aria-labelledby="ctr-hist">
            <h2 id="ctr-hist" className="vj-section-title">
              Histórico
            </h2>
            {timeline.length === 0 ? (
              <EmptyState title="Sem eventos">Nenhum evento na linha do tempo.</EmptyState>
            ) : null}
            <ul className="vj-stack">
              {timeline.map((ev) => (
                <li key={ev.id} className="vj-card">
                  {ev.summary ?? ev.eventType}
                  {ev.occurredAt ? (
                    <span className="vj-meta"> · {formatDateTime(ev.occurredAt)}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}
