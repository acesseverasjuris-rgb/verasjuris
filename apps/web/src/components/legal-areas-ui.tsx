import { Badge } from "@verasjuris/ui";
import {
  LEGAL_AREA_HUB_LABELS,
  legalAreaRouteKey,
  type LegalAreaModule,
  type LegalAreaModuleKey,
  type LegalAreaToolLink,
} from "../lib/legal-areas";

export function LegalAreaHubGrid({ modules }: { modules: LegalAreaModule[] }) {
  return (
    <ul
      className="vj-split"
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 18rem), 1fr))",
      }}
    >
      {modules.map((module) => (
        <li key={module.key}>
          <a
            href={`/app/areas/${legalAreaRouteKey(module.key as LegalAreaModuleKey)}`}
            className="vj-card vj-stack"
            style={{ height: "100%", textDecoration: "none" }}
          >
            <h2 className="vj-section-title">{module.name}</h2>
            <p className="vj-meta">
              {module.description ??
                LEGAL_AREA_HUB_LABELS[module.key as LegalAreaModuleKey]?.description}
            </p>
            {module.active ? (
              <Badge tone="success">Ativo</Badge>
            ) : (
              <Badge tone="neutral">Inativo</Badge>
            )}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function LegalAreaToolsList({ tools }: { tools: LegalAreaToolLink[] }) {
  return (
    <ul className="vj-stack">
      {tools.map((tool) => (
        <li key={tool.href + tool.label}>
          <a className="vj-card vj-stack" href={tool.href}>
            <strong>{tool.label}</strong>
            <span className="vj-meta">{tool.description}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
