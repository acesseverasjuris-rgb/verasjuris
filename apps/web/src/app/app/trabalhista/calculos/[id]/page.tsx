"use client";

import {
  Breadcrumb,
  Button,
  ButtonLink,
  ErrorState,
  FormField,
  LoadingState,
  PageHeader,
  Textarea,
} from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import {
  CalculationMemoryViewer,
  FgtsEstimateNotice,
  LaborCalculationStatusBadge,
  TRABALHISTA_TABS,
} from "../../../../../components/labor-ui";
import {
  LABOR_CALCULATION_TYPE_LABELS,
  fetchLaborCalculation,
  formatDateTime,
  hasLaborPermission,
  isApiFailure,
  laborErrorMessage,
  reviewLaborCalculation,
  runLaborCalculation,
  type LaborCalculation,
} from "../../../../../lib/labor";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function CalculoTrabalhistaDetailPage() {
  const params = useParams<{ id: string }>();
  const calculationId = params.id;
  const org = useOrgContext();
  const canRead = hasLaborPermission(org.permissions, "read");
  const canCalculate = hasLaborPermission(org.permissions, "calculate");
  const canReview = hasLaborPermission(org.permissions, "review_calculation");

  const [calculation, setCalculation] = useState<LaborCalculation | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const data = await fetchLaborCalculation(orgId, calculationId);
      if (isApiFailure(data)) {
        setError(laborErrorMessage(data, "Não foi possível carregar o cálculo."));
        setCalculation(null);
      } else {
        setCalculation(data.calculation);
      }
      setLoading(false);
    },
    [calculationId],
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
    { label: "Trabalhista", href: "/app/trabalhista" },
    { label: "Cálculos", href: "/app/trabalhista/calculos" },
    { label: calculation?.id.slice(0, 8) ?? "Cálculo" },
  ];

  async function onRun() {
    if (!org.orgId || !calculation || !canCalculate) return;
    setBusy(true);
    setActionError(null);
    const data = await runLaborCalculation(org.orgId, calculation.id);
    if (isApiFailure(data)) {
      setActionError(laborErrorMessage(data, "Não foi possível executar o cálculo."));
    } else {
      setCalculation(data.calculation);
    }
    setBusy(false);
  }

  async function onReview(status: "reviewed" | "approved") {
    if (!org.orgId || !calculation || !canReview) return;
    setBusy(true);
    setActionError(null);
    const data = await reviewLaborCalculation(org.orgId, calculation.id, {
      status,
      notes: notes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(laborErrorMessage(data, "Não foi possível revisar o cálculo."));
    } else {
      setCalculation(data.calculation);
    }
    setBusy(false);
  }

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para consultar este cálculo.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title={
          calculation
            ? (LABOR_CALCULATION_TYPE_LABELS[calculation.calculationType] ??
              calculation.calculationType)
            : "Cálculo trabalhista"
        }
        description="Memória FONTE → DADO → REGRA → CÁLCULO → RESULTADO → REVISÃO."
        actions={
          calculation ? (
            <ButtonLink
              href={`/app/trabalhista/casos/${calculation.laborCaseId}`}
              variant="secondary"
            >
              Abrir caso
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs
        label="Seções trabalhistas"
        items={TRABALHISTA_TABS}
        current="/app/trabalhista/calculos"
      />

      {loading || !org.ready ? <LoadingState label="Carregando cálculo" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {actionError ? <ErrorState title="Ação">{actionError}</ErrorState> : null}

      {calculation ? (
        <>
          <div className="vj-inline-actions">
            <LaborCalculationStatusBadge status={calculation.status} />
            <span className="vj-meta">
              Rule set {calculation.ruleSetVersion} · Ref.{" "}
              {formatDateTime(calculation.referenceDate)}
            </span>
          </div>
          {calculation.calculationType === "fgts" ? <FgtsEstimateNotice /> : null}

          <div className="vj-inline-actions">
            {canCalculate && calculation.status !== "approved" ? (
              <Button variant="primary" disabled={busy} onClick={() => void onRun()}>
                {busy ? "Executando…" : "Executar cálculo"}
              </Button>
            ) : null}
          </div>

          <CalculationMemoryViewer
            snapshot={calculation.resultSnapshot}
            status={calculation.status}
          />

          <section className="vj-card vj-stack">
            <h2 className="vj-section-title">Entrada (FONTE / DADO)</h2>
            <pre className="vj-prose vj-technical" style={{ whiteSpace: "pre-wrap" }}>
              {JSON.stringify(calculation.inputSnapshot ?? {}, null, 2)}
            </pre>
          </section>

          {canReview && calculation.status !== "approved" ? (
            <section className="vj-card vj-stack">
              <h2 className="vj-section-title">Revisão humana</h2>
              <FormField id="lab-calc-review-notes" label="Notas (opcional)">
                <Textarea
                  id="lab-calc-review-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </FormField>
              <div className="vj-inline-actions">
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={() => void onReview("reviewed")}
                >
                  Marcar revisado
                </Button>
                <Button variant="primary" disabled={busy} onClick={() => void onReview("approved")}>
                  Aprovar
                </Button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
