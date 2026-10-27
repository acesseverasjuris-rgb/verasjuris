import { PenLine, Link2, Database } from "lucide-react";
import { Badge } from "@verasjuris/ui";
import {
  INTEREST_STATUS_LABELS,
  OPPORTUNITY_SOURCE_LABELS,
  OPPORTUNITY_STATUS_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  opportunityStatusTone,
  type InterestStatus,
  type PublicOpportunitySource,
  type PublicOpportunitySummary,
} from "../lib/public-opportunities";
import { formatDateTime } from "../lib/ai";
import { StatePill } from "./ai-ui";

/** Origem do cadastro. Cadastro manual NUNCA é apresentado como fonte oficial. */
export function SourceBadge({ source }: { source: PublicOpportunitySource }) {
  const icon =
    source === "manual" ? (
      <PenLine size={14} aria-hidden="true" />
    ) : source === "import" ? (
      <Database size={14} aria-hidden="true" />
    ) : (
      <Link2 size={14} aria-hidden="true" />
    );
  return <StatePill icon={icon}>{OPPORTUNITY_SOURCE_LABELS[source]}</StatePill>;
}

export function InterestBadge({ status }: { status: InterestStatus | null | undefined }) {
  if (!status) return null;
  return <Badge tone="neutral">{INTEREST_STATUS_LABELS[status]}</Badge>;
}

export function OpportunityTable({
  items,
  caption,
}: {
  items: PublicOpportunitySummary[];
  caption: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Oportunidade</th>
            <th scope="col">Tipo</th>
            <th scope="col">Situação</th>
            <th scope="col">Prazo para proposta</th>
            <th scope="col">UF</th>
            <th scope="col">Origem</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td data-label="Oportunidade">
                <a href={`/app/oportunidades-publicas/${item.id}`}>
                  <strong>{item.title}</strong>
                </a>
                <div className="vj-meta">{item.publicBodyName ?? "Órgão não informado"}</div>
                {item.interestStatus ? <InterestBadge status={item.interestStatus} /> : null}
              </td>
              <td data-label="Tipo">{OPPORTUNITY_TYPE_LABELS[item.opportunityType]}</td>
              <td data-label="Situação">
                <Badge tone={opportunityStatusTone(item.status)}>
                  {OPPORTUNITY_STATUS_LABELS[item.status]}
                </Badge>
              </td>
              <td data-label="Prazo para proposta">{formatDateTime(item.proposalDeadline)}</td>
              <td data-label="UF">{item.stateCode ?? "—"}</td>
              <td data-label="Origem">
                <SourceBadge source={item.sourceProvider} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
