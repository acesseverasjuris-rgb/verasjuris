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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NoPermission, SectionTabs } from "../../../../../components/ai-ui";
import { CalcLayerTag, PREVIDENCIARIO_TABS } from "../../../../../components/previdentiary-ui";
import {
  PREVIDENTIARY_REGIME_LABELS,
  createPrevidentiaryCase,
  hasPrevidentiaryPermission,
  isApiFailure,
  previdentiaryErrorMessage,
} from "../../../../../lib/previdentiary";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function NovoCasoPrevidenciarioPage() {
  const org = useOrgContext();
  const router = useRouter();
  const canCreate = hasPrevidentiaryPermission(org.permissions, "create");

  const [clientId, setClientId] = useState("");
  const [legalMatterId, setLegalMatterId] = useState("");
  const [regime, setRegime] = useState("rgps");
  const [insuredCategory, setInsuredCategory] = useState("");
  const [currentSituation, setCurrentSituation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Previdenciário", href: "/app/previdenciario" },
    { label: "Casos", href: "/app/previdenciario/casos" },
    { label: "Novo" },
  ];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canCreate) return;
    setSaving(true);
    setError(null);
    const data = await createPrevidentiaryCase(org.orgId, {
      clientId: clientId.trim(),
      legalMatterId: legalMatterId.trim(),
      regime,
      insuredCategory: insuredCategory.trim() || undefined,
      currentSituation: currentSituation.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setError(previdentiaryErrorMessage(data, "Não foi possível criar o caso."));
      setSaving(false);
      return;
    }
    router.push(`/app/previdenciario/casos/${data.case.id}`);
  }

  if (org.ready && !canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para criar casos previdenciários.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Novo caso previdenciário"
        description="Vincule cliente e matéria jurídica. Dados sensíveis (NIT) são mascarados nas listagens."
      />
      <SectionTabs
        label="Seções previdenciárias"
        items={PREVIDENCIARIO_TABS}
        current="/app/previdenciario/casos"
      />

      <Alert tone="info" title="Cadastro interno">
        Este módulo não consulta automaticamente o INSS. Protocolos e benefícios são registros
        internos até verificação humana.
      </Alert>

      <form className="vj-card vj-stack" onSubmit={(event) => void onSubmit(event)}>
        <CalcLayerTag layer="FONTE" />
        <FormField id="prev-client" label="ID do cliente">
          <Input
            id="prev-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className="vj-technical"
          />
        </FormField>
        <FormField id="prev-matter" label="ID do caso jurídico">
          <Input
            id="prev-matter"
            value={legalMatterId}
            onChange={(e) => setLegalMatterId(e.target.value)}
            required
            className="vj-technical"
          />
        </FormField>
        <FormField id="prev-regime-new" label="Regime">
          <Select id="prev-regime-new" value={regime} onChange={(e) => setRegime(e.target.value)}>
            {Object.entries(PREVIDENTIARY_REGIME_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="prev-category" label="Categoria do segurado (opcional)">
          <Input
            id="prev-category"
            value={insuredCategory}
            onChange={(e) => setInsuredCategory(e.target.value)}
          />
        </FormField>
        <FormField id="prev-situation" label="Situação atual (opcional)">
          <Input
            id="prev-situation"
            value={currentSituation}
            onChange={(e) => setCurrentSituation(e.target.value)}
          />
        </FormField>
        <FormField id="prev-notes" label="Observações">
          <Textarea id="prev-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
        <button type="submit" className="vj-button vj-button-primary" disabled={saving}>
          {saving ? "Criando…" : "Criar caso"}
        </button>
      </form>
    </div>
  );
}
