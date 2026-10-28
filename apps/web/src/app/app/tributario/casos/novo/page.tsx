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
import { TRIBUTARIO_TABS } from "../../../../../components/tax-ui";
import {
  TAX_CASE_STATUS_LABELS,
  TAX_JURISDICTION_SCOPE_LABELS,
  TAX_TAXPAYER_TYPE_LABELS,
  createTaxCase,
  hasTaxPermission,
  isApiFailure,
  taxErrorMessage,
} from "../../../../../lib/tax";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function NovoCasoTributarioPage() {
  const org = useOrgContext();
  const router = useRouter();
  const canCreate = hasTaxPermission(org.permissions, "create");

  const [clientId, setClientId] = useState("");
  const [legalMatterId, setLegalMatterId] = useState("");
  const [taxpayerType, setTaxpayerType] = useState("company");
  const [jurisdictionScope, setJurisdictionScope] = useState("federal");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Tributário", href: "/app/tributario" },
    { label: "Casos", href: "/app/tributario/casos" },
    { label: "Novo" },
  ];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canCreate) return;
    setSaving(true);
    setError(null);
    const data = await createTaxCase(org.orgId, {
      clientId: clientId.trim(),
      legalMatterId: legalMatterId.trim(),
      taxpayerType,
      jurisdictionScope,
      status,
      notes: notes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setError(taxErrorMessage(data, "Não foi possível criar o caso."));
      setSaving(false);
      return;
    }
    router.push(`/app/tributario/casos/${data.case.id}`);
  }

  if (org.ready && !canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para criar casos tributários.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Novo caso tributário"
        description="Vincule cliente e matéria jurídica. Integrações fiscais exigem provedor configurado."
      />
      <SectionTabs
        label="Seções tributárias"
        items={TRIBUTARIO_TABS}
        current="/app/tributario/casos"
      />
      <Alert tone="info" title="Cadastro interno">
        Lançamentos e cálculos permanecem disponíveis sem consulta automática à Receita ou SEFAZ.
      </Alert>

      <form className="vj-card vj-stack" onSubmit={(event) => void onSubmit(event)}>
        <FormField id="tax-client" label="ID do cliente">
          <Input
            id="tax-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className="vj-technical"
          />
        </FormField>
        <FormField id="tax-matter" label="ID do caso jurídico">
          <Input
            id="tax-matter"
            value={legalMatterId}
            onChange={(e) => setLegalMatterId(e.target.value)}
            required
            className="vj-technical"
          />
        </FormField>
        <div className="vj-split">
          <FormField id="tax-taxpayer" label="Tipo de contribuinte">
            <Select
              id="tax-taxpayer"
              value={taxpayerType}
              onChange={(e) => setTaxpayerType(e.target.value)}
            >
              {Object.entries(TAX_TAXPAYER_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="tax-scope-new" label="Esfera">
            <Select
              id="tax-scope-new"
              value={jurisdictionScope}
              onChange={(e) => setJurisdictionScope(e.target.value)}
            >
              {Object.entries(TAX_JURISDICTION_SCOPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField id="tax-status-new" label="Situação">
          <Select id="tax-status-new" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(TAX_CASE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="tax-notes" label="Observações">
          <Textarea id="tax-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
        <button type="submit" className="vj-button vj-button-primary" disabled={saving}>
          {saving ? "Criando…" : "Criar caso"}
        </button>
      </form>
    </div>
  );
}
