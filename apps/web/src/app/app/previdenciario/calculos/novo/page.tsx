"use client";

import {
  Alert,
  Breadcrumb,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@verasjuris/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import {
  CalcLayerTag,
  CalculationReviewNotice,
  PREVIDENCIARIO_TABS,
  ScenarioDisclaimer,
} from "../../../../../components/previdentiary-ui";
import {
  CALCULATION_TYPE_LABELS,
  createPrevidentiaryCalculation,
  hasPrevidentiaryPermission,
  isApiFailure,
  previdentiaryErrorMessage,
} from "../../../../../lib/previdentiary";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function NovoCalculoPrevidenciarioPage() {
  const org = useOrgContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCalculate = hasPrevidentiaryPermission(org.permissions, "calculate");

  const [previdentiaryCaseId, setPrevidentiaryCaseId] = useState(searchParams.get("caseId") ?? "");
  const [calculationType, setCalculationType] = useState("tempo");
  const [ruleSetVersion, setRuleSetVersion] = useState("v1");
  const [referenceDate, setReferenceDate] = useState(new Date().toISOString().slice(0, 10));
  const [inputJson, setInputJson] = useState("{\n  \n}");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Previdenciário", href: "/app/previdenciario" },
    { label: "Cálculos", href: "/app/previdenciario/calculos" },
    { label: "Novo" },
  ];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canCalculate) return;
    let inputSnapshot: Record<string, unknown> = {};
    try {
      inputSnapshot = JSON.parse(inputJson) as Record<string, unknown>;
    } catch {
      setError("Informe um JSON válido no snapshot de entrada.");
      return;
    }
    setSaving(true);
    setError(null);
    const data = await createPrevidentiaryCalculation(org.orgId, {
      previdentiaryCaseId: previdentiaryCaseId.trim(),
      calculationType,
      ruleSetVersion: ruleSetVersion.trim(),
      referenceDate: new Date(`${referenceDate}T12:00:00.000Z`).toISOString(),
      inputSnapshot,
    });
    if (isApiFailure(data)) {
      setError(previdentiaryErrorMessage(data, "Não foi possível criar o cálculo."));
      setSaving(false);
      return;
    }
    router.push(`/app/previdenciario/calculos/${data.calculation.id}`);
  }

  if (org.ready && !canCalculate) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para criar cálculos previdenciários.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Novo cálculo previdenciário"
        description="FONTE → DADO → REGRA → CÁLCULO → RESULTADO → REVISÃO. Dinheiro em centavos inteiros."
      />
      <SectionTabs
        label="Seções previdenciárias"
        items={PREVIDENCIARIO_TABS}
        current="/app/previdenciario/calculos"
      />
      <CalculationReviewNotice />
      {calculationType === "scenarios" ? <ScenarioDisclaimer /> : null}

      <form className="vj-card vj-stack" onSubmit={(event) => void onSubmit(event)}>
        <CalcLayerTag layer="DADO" />
        <FormField id="calc-case" label="ID do caso previdenciário">
          <Input
            id="calc-case"
            value={previdentiaryCaseId}
            onChange={(e) => setPrevidentiaryCaseId(e.target.value)}
            required
            className="vj-technical"
          />
        </FormField>
        <FormField id="calc-type-new" label="Tipo">
          <Select
            id="calc-type-new"
            value={calculationType}
            onChange={(e) => setCalculationType(e.target.value)}
          >
            {Object.entries(CALCULATION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="vj-split">
          <FormField id="calc-ruleset" label="Versão do rule set">
            <Input
              id="calc-ruleset"
              value={ruleSetVersion}
              onChange={(e) => setRuleSetVersion(e.target.value)}
              required
            />
          </FormField>
          <FormField id="calc-ref" label="Data de referência">
            <Input
              id="calc-ref"
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              required
            />
          </FormField>
        </div>
        <Alert tone="info" title="REGRA · Entrada">
          Informe o snapshot de entrada em JSON conforme o motor escolhido.
        </Alert>
        <FormField id="calc-input" label="inputSnapshot (JSON)">
          <Textarea
            id="calc-input"
            value={inputJson}
            onChange={(e) => setInputJson(e.target.value)}
            className="vj-technical"
            rows={10}
          />
        </FormField>
        {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
        <button type="submit" className="vj-button vj-button-primary" disabled={saving}>
          {saving ? "Criando…" : "Criar cálculo"}
        </button>
      </form>
    </div>
  );
}
