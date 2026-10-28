import { Alert, Badge } from "@verasjuris/ui";
import {
  CONTRACT_PARTY_ROLE_LABELS,
  CONTRACT_STATUS_LABELS,
  SIGNATURE_PROVIDER_NOT_CONFIGURED_MESSAGE,
  formatDateTime,
  formatMoneyCents,
  type Contract,
  type ContractApproval,
  type ContractClauseInstance,
  type ContractParty,
  type ContractVersion,
  type SignatureRequest,
} from "../lib/contracts";

export const CONTRATO_TABS = [
  { href: "/app/contratos", label: "Visão geral" },
  { href: "/app/contratos/novo", label: "Novo" },
  { href: "/app/contratos/templates", label: "Modelos" },
  { href: "/app/contratos/clausulas", label: "Cláusulas" },
  { href: "/app/contratos/aprovacoes", label: "Aprovações" },
  { href: "/app/contratos/assinaturas", label: "Assinaturas" },
];

export const CONTRACT_DETAIL_SECTIONS = [
  { id: "resumo", label: "Resumo" },
  { id: "versoes", label: "Versões" },
  { id: "partes", label: "Partes" },
  { id: "clausulas", label: "Cláusulas" },
  { id: "aprovacoes", label: "Aprovações" },
  { id: "assinaturas", label: "Assinaturas" },
  { id: "obrigacoes", label: "Obrigações" },
  { id: "documentos", label: "Documentos" },
  { id: "renovacoes", label: "Renovações" },
  { id: "rescisao", label: "Rescisão" },
  { id: "prazos", label: "Prazos" },
  { id: "tarefas", label: "Tarefas" },
  { id: "historico", label: "Histórico" },
] as const;

type Tone = "neutral" | "success" | "warning" | "error";

function statusTone(status: string): Tone {
  if (status === "signed" || status === "active" || status === "approved") return "success";
  if (
    status === "pending_signature" ||
    status === "pending_approval" ||
    status === "internal_review" ||
    status === "draft" ||
    status === "partially_signed"
  ) {
    return "warning";
  }
  if (status === "terminated" || status === "cancelled" || status === "expired") return "error";
  return "neutral";
}

export function SignatureProviderBanner({
  notConfigured,
  providerLabel,
}: {
  notConfigured: boolean;
  providerLabel?: string;
}) {
  if (!notConfigured) return null;
  return (
    <Alert tone="warning" title="Assinatura eletrônica">
      {SIGNATURE_PROVIDER_NOT_CONFIGURED_MESSAGE}
      {providerLabel ? (
        <p className="vj-meta" style={{ marginTop: "0.5rem" }}>
          Provider: {providerLabel}
        </p>
      ) : (
        <p className="vj-meta" style={{ marginTop: "0.5rem" }}>
          Provider: NOT_CONFIGURED
        </p>
      )}
    </Alert>
  );
}

export function ContractSectionNav({ current }: { current?: string }) {
  return (
    <nav aria-label="Seções do contrato">
      <ul
        className="vj-inline-actions"
        style={{ listStyle: "none", margin: 0, padding: 0, flexWrap: "wrap" }}
      >
        {CONTRACT_DETAIL_SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              className={current === section.id ? "vj-button vj-button-secondary" : "vj-link"}
              aria-current={current === section.id ? "true" : undefined}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ContractStatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{CONTRACT_STATUS_LABELS[status] ?? status}</Badge>;
}

export function ContractsTable({ items, caption }: { items: Contract[]; caption: string }) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Título</th>
            <th scope="col">Tipo</th>
            <th scope="col">Situação</th>
            <th scope="col">Vigência</th>
            <th scope="col">Ações</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.title}</td>
              <td>{item.contractType}</td>
              <td>
                <ContractStatusBadge status={item.status} />
              </td>
              <td>
                {item.effectiveDate ? formatDateTime(item.effectiveDate) : "—"}
                {item.expirationDate ? ` → ${formatDateTime(item.expirationDate)}` : ""}
              </td>
              <td>
                <a href={`/app/contratos/${item.id}`}>Abrir</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ContractStatusDashboard({ counts }: { counts: Record<string, number> }) {
  const keys = [
    "draft",
    "pending_approval",
    "pending_signature",
    "active",
    "expiring",
    "terminated",
  ] as const;
  return (
    <div
      className="vj-split"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 14rem), 1fr))" }}
    >
      {keys.map((key) => (
        <div key={key} className="vj-card vj-stack">
          <h2 className="vj-section-title">{CONTRACT_STATUS_LABELS[key] ?? key}</h2>
          <p className="vj-title">{counts[key] ?? 0}</p>
        </div>
      ))}
    </div>
  );
}

export function ContractVersionsList({ items }: { items: ContractVersion[] }) {
  if (items.length === 0) return null;
  return (
    <ol className="vj-stack">
      {items.map((v) => (
        <li key={v.id} className="vj-card">
          Versão {v.version} — <Badge tone={statusTone(v.status)}>{v.status}</Badge>
        </li>
      ))}
    </ol>
  );
}

export function ContractPartiesList({ items }: { items: ContractParty[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="vj-stack">
      {items.map((p) => (
        <li key={p.id} className="vj-card">
          <strong>{p.displayName}</strong>{" "}
          <span className="vj-meta">{CONTRACT_PARTY_ROLE_LABELS[p.role] ?? p.role}</span>
        </li>
      ))}
    </ul>
  );
}

export function ContractClausesList({ items }: { items: ContractClauseInstance[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="vj-stack">
      {items.map((c) => (
        <li key={c.id} className="vj-card">
          {c.title ?? c.clauseKey ?? "Cláusula"}
        </li>
      ))}
    </ul>
  );
}

export function ContractApprovalsList({ items }: { items: ContractApproval[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="vj-stack">
      {items.map((a) => (
        <li key={a.id} className="vj-card">
          <Badge tone={statusTone(a.status)}>{a.status}</Badge>
        </li>
      ))}
    </ul>
  );
}

export function SignatureRequestsList({ items }: { items: SignatureRequest[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="vj-stack">
      {items.map((s) => (
        <li key={s.id} className="vj-card">
          <Badge tone={statusTone(s.status)}>{s.status}</Badge>
          <span className="vj-meta">{s.providerKey ?? "NOT_CONFIGURED"}</span>
        </li>
      ))}
    </ul>
  );
}

export function ContractSummaryCard({ contract }: { contract: Contract }) {
  return (
    <section id="resumo" className="vj-card vj-stack" aria-labelledby="contract-resumo-title">
      <h2 id="contract-resumo-title" className="vj-section-title">
        Resumo
      </h2>
      <ContractStatusBadge status={contract.status} />
      <p>{contract.title}</p>
      {contract.totalValueCents != null ? (
        <p className="vj-meta">Valor: {formatMoneyCents(contract.totalValueCents)}</p>
      ) : null}
      <p className="vj-meta">Atualizado em {formatDateTime(contract.updatedAt)}</p>
    </section>
  );
}
