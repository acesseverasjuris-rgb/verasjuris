import { Alert, Badge } from "@verasjuris/ui";
import {
  BENEFIT_STATUS_LABELS,
  CALCULATION_REVIEW_DISCLAIMER,
  CALCULATION_STATUS_LABELS,
  CALCULATION_TYPE_LABELS,
  CNIS_IMPORT_STATUS_LABELS,
  CNIS_NOT_OFFICIAL_DISCLAIMER,
  HIGHEST_SCENARIO_DISCLAIMER,
  MANUAL_PROTOCOL_DISCLAIMER,
  PREVIDENTIARY_REGIME_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_TYPE_LABELS,
  formatDateTime,
  formatMoneyCents,
  maskNit,
  parseCalculationSnapshot,
  type CalculationMemoryStep,
  type CalculationResultSnapshot,
  type PrevidentiaryCalculation,
  type PrevidentiaryCase,
  type PrevidentiaryClientProfile,
  type PrevidentiaryRequest,
  type SocialSecurityBenefit,
} from "../lib/previdentiary";

export const PREVIDENCIARIO_TABS = [
  { href: "/app/previdenciario", label: "Visão geral" },
  { href: "/app/previdenciario/casos", label: "Casos" },
  { href: "/app/previdenciario/calculos", label: "Cálculos" },
];

export const PREVIDENTIARY_CASE_SECTIONS = [
  { id: "resumo", label: "Resumo" },
  { id: "beneficios", label: "Benefícios" },
  { id: "requerimentos", label: "Requerimentos" },
  { id: "cnis", label: "CNIS" },
  { id: "contribuicoes", label: "Contribuições" },
  { id: "calculos", label: "Cálculos" },
  { id: "documentos", label: "Documentos" },
  { id: "pericias", label: "Perícias" },
  { id: "prazos", label: "Prazos" },
  { id: "tarefas", label: "Tarefas" },
  { id: "historico", label: "Histórico" },
] as const;

export type CalcLayer = "FONTE" | "DADO" | "REGRA" | "CÁLCULO" | "RESULTADO" | "REVISÃO";

export const CALC_LAYERS: CalcLayer[] = [
  "FONTE",
  "DADO",
  "REGRA",
  "CÁLCULO",
  "RESULTADO",
  "REVISÃO",
];

type Tone = "neutral" | "success" | "warning" | "error";

function statusTone(status: string): Tone {
  if (
    status === "approved" ||
    status === "reviewed" ||
    status === "active" ||
    status === "granted"
  ) {
    return "success";
  }
  if (
    status === "review_required" ||
    status === "draft" ||
    status === "pending_review" ||
    status === "not_configured"
  ) {
    return "warning";
  }
  if (
    status === "denied" ||
    status === "cancelled" ||
    status === "failed" ||
    status === "rejected"
  ) {
    return "error";
  }
  return "neutral";
}

export function CalcLayerTag({ layer }: { layer: CalcLayer }) {
  return <span className="vj-meta">{layer}</span>;
}

export function CalcLayerPipeline() {
  return (
    <p className="vj-meta">
      <span className="vj-meta">Camadas do cálculo: </span>
      {CALC_LAYERS.map((layer, index) => (
        <span key={layer}>
          {index > 0 ? " → " : null}
          <CalcLayerTag layer={layer} />
        </span>
      ))}
    </p>
  );
}

export function PrevidentiaryCaseSectionNav({ current }: { current?: string }) {
  return (
    <nav aria-label="Seções do caso previdenciário">
      <ul
        className="vj-inline-actions"
        style={{ listStyle: "none", margin: 0, padding: 0, flexWrap: "wrap" }}
      >
        {PREVIDENTIARY_CASE_SECTIONS.map((section) => (
          <li key={section.id}>
            <a
              className={`vj-button ${current === section.id ? "vj-button-primary" : "vj-button-secondary"}`}
              href={`#${section.id}`}
            >
              {section.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function BenefitStatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{BENEFIT_STATUS_LABELS[status] ?? status}</Badge>;
}

export function RequestStatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{REQUEST_STATUS_LABELS[status] ?? status}</Badge>;
}

export function CalculationStatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{CALCULATION_STATUS_LABELS[status] ?? status}</Badge>;
}

export function CnisStatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone(status)}>{CNIS_IMPORT_STATUS_LABELS[status] ?? status}</Badge>;
}

export function ManualProtocolNotice() {
  return (
    <Alert tone="info" title="Protocolo manual">
      {MANUAL_PROTOCOL_DISCLAIMER}
    </Alert>
  );
}

export function CnisDisclaimer() {
  return (
    <Alert tone="info" title="CNIS · Cadastro interno">
      {CNIS_NOT_OFFICIAL_DISCLAIMER}
    </Alert>
  );
}

export function ScenarioDisclaimer() {
  return (
    <Alert tone="info" title="Cenários simulados">
      {HIGHEST_SCENARIO_DISCLAIMER}
    </Alert>
  );
}

export function CalculationReviewNotice() {
  return (
    <Alert tone="warning" title="REVISÃO · Humana">
      {CALCULATION_REVIEW_DISCLAIMER}
    </Alert>
  );
}

export function CalculationWarningsBanner({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <Alert tone="warning" title="Avisos do cálculo">
      <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </Alert>
  );
}

export function CalculationMemoryViewer({
  snapshot,
  status,
}: {
  snapshot: CalculationResultSnapshot | null | undefined;
  status?: string;
}) {
  const parsed = parseCalculationSnapshot(snapshot);
  const needsReview =
    status === "review_required" ||
    status === "calculated" ||
    parsed.reviewHint === "review_required";

  return (
    <div className="vj-stack">
      <CalcLayerPipeline />
      {needsReview ? <CalculationReviewNotice /> : null}
      <CalculationWarningsBanner warnings={parsed.warnings} />
      {parsed.missingData.length > 0 ? (
        <Alert tone="info" title="Dados ausentes">
          <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {parsed.missingData.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <section className="vj-card vj-stack" aria-labelledby="calc-memory-title">
        <h2 id="calc-memory-title" className="vj-section-title">
          Memória de cálculo
        </h2>
        <p className="vj-meta">
          <CalcLayerTag layer="CÁLCULO" /> Passos determinísticos registrados pelo motor.
        </p>
        {parsed.memory.length === 0 ? (
          <p className="vj-meta">Nenhum passo de memória disponível. Execute o cálculo.</p>
        ) : (
          <ol className="vj-stack" style={{ margin: 0, paddingLeft: "1.25rem" }}>
            {parsed.memory.map((step: CalculationMemoryStep) => (
              <li key={`${step.key}-${step.description}`}>
                <strong>{step.description}</strong>
                <div className="vj-meta">{step.key}</div>
                {step.detail ? (
                  <pre className="vj-prose vj-technical" style={{ whiteSpace: "pre-wrap" }}>
                    {JSON.stringify(step.detail, null, 2)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="vj-card vj-stack" aria-labelledby="calc-result-title">
        <h2 id="calc-result-title" className="vj-section-title">
          Resultado
        </h2>
        <p className="vj-meta">
          <CalcLayerTag layer="RESULTADO" />{" "}
          {parsed.ruleSetVersion ? `Rule set ${parsed.ruleSetVersion}` : "Rule set não informado"}
        </p>
        {parsed.result == null ? (
          <p className="vj-meta">Sem resultado persistido.</p>
        ) : (
          <pre className="vj-prose vj-technical" style={{ whiteSpace: "pre-wrap" }}>
            {JSON.stringify(parsed.result, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}

export function formatMoney(cents: number | null | undefined) {
  return formatMoneyCents(cents);
}

export function PrevidentiaryCasesTable({
  items,
  caption,
}: {
  items: PrevidentiaryCase[];
  caption: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Caso</th>
            <th scope="col">Regime</th>
            <th scope="col">Situação</th>
            <th scope="col">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <a href={`/app/previdenciario/casos/${item.id}`}>{item.id.slice(0, 8)}…</a>
                <div className="vj-meta">Cliente {item.clientId.slice(0, 8)}…</div>
              </td>
              <td>{PREVIDENTIARY_REGIME_LABELS[item.regime] ?? item.regime}</td>
              <td>{item.currentSituation || "—"}</td>
              <td>{formatDateTime(item.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BenefitsTable({
  items,
  caption,
}: {
  items: SocialSecurityBenefit[];
  caption: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Benefício</th>
            <th scope="col">NB</th>
            <th scope="col">Situação</th>
            <th scope="col">Fonte</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <a href={`/app/previdenciario/beneficios/${item.id}`}>{item.id.slice(0, 8)}…</a>
              </td>
              <td className="vj-technical">{item.nb || "—"}</td>
              <td>
                <BenefitStatusBadge status={item.status} />
              </td>
              <td>
                <span className="vj-meta">{item.source ?? "manual"}</span>
                {item.officialInssClaim === false ? (
                  <div className="vj-meta">Cadastro interno (não oficial INSS)</div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RequestsTable({
  items,
  caption,
}: {
  items: PrevidentiaryRequest[];
  caption: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Requerimento</th>
            <th scope="col">Tipo</th>
            <th scope="col">Protocolo</th>
            <th scope="col">Situação</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="vj-technical">{item.id.slice(0, 8)}…</td>
              <td>{REQUEST_TYPE_LABELS[item.requestType] ?? item.requestType}</td>
              <td>
                {item.protocolNumber ? (
                  <>
                    <span className="vj-technical">{item.protocolNumber}</span>
                    <div className="vj-meta">
                      {item.protocolLabel ?? MANUAL_PROTOCOL_DISCLAIMER}
                    </div>
                  </>
                ) : (
                  "—"
                )}
              </td>
              <td>
                <RequestStatusBadge status={item.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CalculationsTable({
  items,
  caption,
}: {
  items: PrevidentiaryCalculation[];
  caption: string;
}) {
  return (
    <div className="vj-table-wrap">
      <table className="vj-table">
        <caption className="vj-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Cálculo</th>
            <th scope="col">Tipo</th>
            <th scope="col">Situação</th>
            <th scope="col">Referência</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <a href={`/app/previdenciario/calculos/${item.id}`}>{item.id.slice(0, 8)}…</a>
              </td>
              <td>{CALCULATION_TYPE_LABELS[item.calculationType] ?? item.calculationType}</td>
              <td>
                <CalculationStatusBadge status={item.status} />
              </td>
              <td>{formatDateTime(item.referenceDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ClientProfileCard({
  profile,
}: {
  profile: PrevidentiaryClientProfile | null | undefined;
}) {
  if (!profile) {
    return <p className="vj-meta">Perfil previdenciário não cadastrado.</p>;
  }
  return (
    <dl className="vj-stack">
      <div>
        <dt className="vj-meta">NIT</dt>
        <dd>{maskNit(profile.nitMasked)}</dd>
      </div>
      <div>
        <dt className="vj-meta">PIS</dt>
        <dd>{maskNit(profile.pisMasked)}</dd>
      </div>
      <div>
        <dt className="vj-meta">Categoria / ocupação</dt>
        <dd>
          {profile.category || "—"}
          {profile.occupation ? ` · ${profile.occupation}` : ""}
        </dd>
      </div>
    </dl>
  );
}
