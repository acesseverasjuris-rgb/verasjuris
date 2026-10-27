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
  CalculationStatusBadge,
  PREVIDENCIARIO_TABS,
  ScenarioDisclaimer,
} from "../../../../../components/previdentiary-ui";
import {
  CALCULATION_TYPE_LABELS,
  fetchPrevidentiaryCalculation,
  formatDateTime,
  hasPrevidentiaryPermission,
  isApiFailure,
  previdentiaryErrorMessage,
  reviewPrevidentiaryCalculation,
  runPrevidentiaryCalculation,
  type PrevidentiaryCalculation,
} from "../../../../../lib/previdentiary";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function CalculoPrevidenciarioDetailPage() {
  const params = useParams<{ id: string }>();
  const calculationId = params.id;
  const org = useOrgContext();
  const canRead = hasPrevidentiaryPermission(org.permissions, "read");
  const canCalculate = hasPrevidentiaryPermission(org.permissions, "calculate");
  const canReview = hasPrevidentiaryPermission(org.permissions, "review_calculation");

  const [calculation, setCalculation] = useState<PrevidentiaryCalculation | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (orgId: string) => {
      setLoading(true);
      setError(null);
      const data = await fetchPrevidentiaryCalculation(orgId, calculationId);
      if (isApiFailure(data)) {
        setError(previdentiaryErrorMessage(data, "Não foi possível carregar o cálculo."));
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
    { label: "Previdenciário", href: "/app/previdenciario" },
    { label: "Cálculos", href: "/app/previdenciario/calculos" },
    { label: calculation?.id.slice(0, 8) ?? "Cálculo" },
  ];

  async function onRun() {
    if (!org.orgId || !calculation || !canCalculate) return;
    setBusy(true);
    setActionError(null);
    const data = await runPrevidentiaryCalculation(org.orgId, calculation.id);
    if (isApiFailure(data)) {
      setActionError(previdentiaryErrorMessage(data, "Não foi possível executar o cálculo."));
    } else {
      setCalculation(data.calculation);
    }
    setBusy(false);
  }

  async function onReview(decision: "reviewed" | "approved") {
    if (!org.orgId || !calculation || !canReview) return;
    setBusy(true);
    setActionError(null);
    const data = await reviewPrevidentiaryCalculation(org.orgId, calculation.id, {
      decision,
      notes: notes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setActionError(previdentiaryErrorMessage(data, "Não foi possível revisar o cálculo."));
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
            ? (CALCULATION_TYPE_LABELS[calculation.calculationType] ?? calculation.calculationType)
            : "Cálculo previdenciário"
        }
        description="Memória de cálculo e avisos. Resultado exige revisão humana."
        actions={
          calculation ? (
            <ButtonLink
              href={`/app/previdenciario/casos/${calculation.previdentiaryCaseId}`}
              variant="secondary"
            >
              Abrir caso
            </ButtonLink>
          ) : null
        }
      />
      <SectionTabs
        label="Seções previdenciárias"
        items={PREVIDENCIARIO_TABS}
        current="/app/previdenciario/calculos"
      />

      {loading || !org.ready ? <LoadingState label="Carregando cálculo" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {actionError ? <ErrorState title="Ação">{actionError}</ErrorState> : null}

      {calculation ? (
        <>
          <div className="vj-inline-actions">
            <CalculationStatusBadge status={calculation.status} />
            <span className="vj-meta">
              Rule set {calculation.ruleSetVersion} · Ref.{" "}
              {formatDateTime(calculation.referenceDate)}
            </span>
          </div>
          {calculation.calculationType === "scenarios" ? <ScenarioDisclaimer /> : null}

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
              <FormField id="calc-review-notes" label="Notas (opcional)">
                <Textarea
                  id="calc-review-notes"
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
