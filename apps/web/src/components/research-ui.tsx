import { Badge, Button } from "@verasjuris/ui";
import {
  BookMarked,
  CheckCircle2,
  CircleDashed,
  Link2,
  PenLine,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  CITATION_VERIFICATION_LABELS,
  verificationLabel,
  verificationTone,
  type CitationVerificationStatus,
} from "../lib/citations";
import {
  catalogTitle,
  RESEARCH_SOURCE_TYPE_LABELS,
  sourceProviderLabel,
  type CatalogItem,
  type ResearchHit,
  type ResearchSourceType,
} from "../lib/legal-research";
import { StatePill } from "./ai-ui";

export const RESEARCH_TABS = [
  { href: "/app/pesquisa", label: "Pesquisar" },
  { href: "/app/pesquisa/jurisprudencia", label: "Jurisprudência" },
  { href: "/app/pesquisa/legislacao", label: "Legislação" },
  { href: "/app/pesquisa/sumulas", label: "Súmulas" },
  { href: "/app/pesquisa/temas", label: "Temas" },
  { href: "/app/pesquisa/precedentes", label: "Precedentes" },
  { href: "/app/pesquisa/doutrina", label: "Doutrina" },
];

export function SourceTypeBadge({ type }: { type: string }) {
  return (
    <Badge tone="neutral">
      {RESEARCH_SOURCE_TYPE_LABELS[type as ResearchSourceType] ?? type.replaceAll("_", " ")}
    </Badge>
  );
}

export function SourceOriginBadge({ provider }: { provider: string | null | undefined }) {
  const icon =
    !provider || provider === "not_configured" ? (
      <CircleDashed size={14} aria-hidden="true" />
    ) : provider === "manual" ? (
      <PenLine size={14} aria-hidden="true" />
    ) : (
      <Link2 size={14} aria-hidden="true" />
    );
  return <StatePill icon={icon}>{sourceProviderLabel(provider)}</StatePill>;
}

/** Badges de verificação — nunca “oficial” sem prova. */
export function VerificationBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? "unverified") as CitationVerificationStatus;
  const tone = verificationTone(key);
  const icon =
    key === "verified" ? (
      <ShieldCheck size={14} aria-hidden="true" />
    ) : key === "source_available" ? (
      <CheckCircle2 size={14} aria-hidden="true" />
    ) : key === "source_unavailable" || key === "invalid" ? (
      <ShieldAlert size={14} aria-hidden="true" />
    ) : (
      <CircleDashed size={14} aria-hidden="true" />
    );
  return (
    <StatePill tone={tone} icon={icon}>
      {CITATION_VERIFICATION_LABELS[key] ?? verificationLabel(status)}
    </StatePill>
  );
}

export function LayerTag({ layer }: { layer: "FONTE" | "ANÁLISE" | "AÇÃO" }) {
  return <span className="vj-meta">{layer}</span>;
}

export function ResearchHitCard({
  hit,
  canCite,
  canSave,
  citing,
  onCite,
  children,
}: {
  hit: ResearchHit;
  canCite?: boolean;
  canSave?: boolean;
  citing?: boolean;
  onCite?: () => void;
  children?: ReactNode;
}) {
  return (
    <article className="vj-card vj-stack" aria-label={hit.title}>
      <div className="vj-header-actions">
        <h3 className="vj-section-title">{hit.title}</h3>
        <SourceTypeBadge type={hit.sourceType} />
      </div>
      <div className="vj-inline-actions">
        <SourceOriginBadge provider={hit.provider} />
        <VerificationBadge status="unverified" />
      </div>
      {hit.excerpt ? <p className="vj-prose">{hit.excerpt}</p> : null}
      {hit.sourceUrl ? (
        <p className="vj-meta">
          FONTE:{" "}
          <a href={hit.sourceUrl} target="_blank" rel="noopener noreferrer">
            Abrir fonte
          </a>
        </p>
      ) : (
        <p className="vj-meta">FONTE: URL não informada</p>
      )}
      <div className="vj-inline-actions">
        {canCite && onCite ? (
          <Button type="button" variant="secondary" disabled={citing} onClick={onCite}>
            <BookMarked size={16} aria-hidden="true" /> Gerar citação
          </Button>
        ) : null}
        {children}
      </div>
      {canSave ? <LayerTag layer="AÇÃO" /> : null}
    </article>
  );
}

export function CatalogResultList({
  items,
  sourceType,
  emptyLabel,
  canCite,
  citingId,
  onCite,
  caption,
}: {
  items: CatalogItem[];
  sourceType: ResearchSourceType;
  emptyLabel: string;
  canCite: boolean;
  citingId: string | null;
  onCite: (item: CatalogItem) => void;
  caption: string;
}) {
  if (items.length === 0) {
    return <p className="vj-meta">{emptyLabel}</p>;
  }
  return (
    <ul
      className="vj-stack"
      style={{ listStyle: "none", margin: 0, padding: 0 }}
      aria-label={caption}
    >
      {items.map((item) => {
        const title = catalogTitle(item, sourceType);
        const excerpt =
          (item.headnote as string | undefined) ??
          (item.text as string | undefined) ??
          (item.thesis as string | undefined) ??
          (item.subject as string | undefined) ??
          (item.applicabilityNotes as string | undefined) ??
          (item.author as string | undefined) ??
          null;
        return (
          <li key={item.id}>
            <ResearchHitCard
              hit={{
                sourceType,
                sourceId: item.id,
                title,
                excerpt,
                sourceUrl: item.sourceUrl,
                provider: (item.sourceProvider as string) ?? (item.provider as string) ?? "manual",
              }}
              canCite={canCite}
              citing={citingId === item.id}
              onCite={() => onCite(item)}
            />
          </li>
        );
      })}
    </ul>
  );
}
