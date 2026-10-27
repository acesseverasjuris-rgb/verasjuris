import { Badge } from "@verasjuris/ui";
import {
  LEGAL_TEMPLATE_KIND_LABELS,
  LEGAL_TEMPLATE_TYPE_LABELS,
  LEGAL_TEMPLATE_VERSION_STATUS_LABELS,
  formatDateTime,
  templateKindLabel,
  templateTypeLabel,
  templateVersionStatusLabel,
  type LegalTemplateDocumentKind,
  type LegalTemplateSummary,
  type LegalTemplateType,
  type LegalTemplateVersion,
  type LegalTemplateVersionStatus,
} from "../lib/legal-templates";
import { StatePill } from "./ai-ui";

export const DOCUMENTOS_JURIDICOS_TABS = [
  { href: "/app/documentos-juridicos", label: "Visão geral" },
  { href: "/app/documentos-juridicos/templates", label: "Modelos" },
  { href: "/app/documentos-juridicos/minutas", label: "Minutas" },
];

type Tone = "neutral" | "success" | "warning" | "error";

export function TemplateTypeBadge({ type }: { type: string }) {
  return (
    <Badge tone="neutral">
      {LEGAL_TEMPLATE_TYPE_LABELS[type as LegalTemplateType] ?? templateTypeLabel(type)}
    </Badge>
  );
}

export function TemplateKindBadge({ kind }: { kind: string }) {
  return (
    <Badge tone="neutral">
      {LEGAL_TEMPLATE_KIND_LABELS[kind as LegalTemplateDocumentKind] ?? templateKindLabel(kind)}
    </Badge>
  );
}

export function TemplateVersionStatusBadge({ status }: { status: string }) {
  const tone: Tone =
    status === "active" || status === "approved"
      ? "success"
      : status === "review"
        ? "warning"
        : status === "archived" || status === "deprecated"
          ? "neutral"
          : "neutral";
  return (
    <Badge tone={tone}>
      {LEGAL_TEMPLATE_VERSION_STATUS_LABELS[status as LegalTemplateVersionStatus] ??
        templateVersionStatusLabel(status)}
    </Badge>
  );
}

export function TemplateScopeBadge({ scope }: { scope: string }) {
  return (
    <StatePill>
      {scope === "system" ? "FONTE · Modelo do sistema" : "FONTE · Modelo da organização"}
    </StatePill>
  );
}

export function TemplateListTable({
  items,
  caption,
}: {
  items: LegalTemplateSummary[];
  caption: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Modelo</th>
            <th scope="col">Tipo</th>
            <th scope="col">Escopo</th>
            <th scope="col">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td data-label="Modelo">
                <a href={`/app/documentos-juridicos/templates/${item.id}`}>
                  <strong>{item.name}</strong>
                </a>
                {item.description ? <div className="vj-meta">{item.description}</div> : null}
                {!item.active ? <div className="vj-meta">Inativo</div> : null}
              </td>
              <td data-label="Tipo">
                <TemplateTypeBadge type={item.templateType} />
              </td>
              <td data-label="Escopo">
                <TemplateScopeBadge scope={item.scope} />
              </td>
              <td data-label="Atualizado">{formatDateTime(item.updatedAt ?? item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HighlightedPreview({
  rendered,
  missingVariables,
}: {
  rendered: string;
  missingVariables: string[];
}) {
  const missing = new Set(missingVariables);
  const parts = rendered.split(/(\{\{[^}]+\}\}|\[\[[^\]]+\]\])/g);
  return (
    <section aria-label="Pré-visualização do modelo">
      <pre
        className="vj-prose"
        style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}
      >
        {parts.map((part) => {
          const isMarker = /^\{\{[^}]+\}\}$|^\[\[[^\]]+\]\]$/.test(part);
          const keyMatch = part.replace(/^\{\{|\}\}$|^\[\[|\]\]$/g, "").trim();
          const highlight = isMarker || missing.has(keyMatch);
          const key = `${part.slice(0, 48)}-${keyMatch || "text"}-${highlight ? "h" : "n"}`;
          if (!highlight) return <span key={key}>{part}</span>;
          return (
            <mark
              key={key}
              style={{ background: "var(--vj-warning-bg, #fff3cd)", padding: "0 0.15rem" }}
            >
              {part}
            </mark>
          );
        })}
      </pre>
    </section>
  );
}

export function VersionList({
  versions,
  currentVersionId,
  onSelect,
}: {
  versions: LegalTemplateVersion[];
  currentVersionId?: string | null;
  onSelect?: (version: LegalTemplateVersion) => void;
}) {
  if (versions.length === 0) {
    return <p className="vj-meta">Nenhuma versão cadastrada.</p>;
  }
  return (
    <ul className="vj-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {versions.map((version) => (
        <li key={version.id} className="vj-stack">
          <div className="vj-inline-actions">
            {onSelect ? (
              <button
                type="button"
                className="vj-button vj-button-secondary"
                onClick={() => onSelect(version)}
              >
                v{version.version}
              </button>
            ) : (
              <strong>v{version.version}</strong>
            )}
            <TemplateVersionStatusBadge status={version.status} />
            {currentVersionId === version.id ? <Badge tone="success">Atual</Badge> : null}
          </div>
          <span className="vj-meta">{formatDateTime(version.createdAt)}</span>
          {version.changelog ? <p className="vj-prose">{version.changelog}</p> : null}
        </li>
      ))}
    </ul>
  );
}
