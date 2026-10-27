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
import { CalcLayerTag, TRABALHISTA_TABS } from "../../../../../components/labor-ui";
import {
  LABOR_CASE_STATUS_LABELS,
  LABOR_CLIENT_ROLE_LABELS,
  createLaborCase,
  hasLaborPermission,
  isApiFailure,
  laborErrorMessage,
} from "../../../../../lib/labor";
import { useOrgContext } from "../../../../../lib/use-org-context";

export default function NovoCasoTrabalhistaPage() {
  const org = useOrgContext();
  const router = useRouter();
  const canCreate = hasLaborPermission(org.permissions, "create");

  const [clientId, setClientId] = useState("");
  const [legalMatterId, setLegalMatterId] = useState("");
  const [clientRole, setClientRole] = useState("employee");
  const [status, setStatus] = useState("draft");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Trabalhista", href: "/app/trabalhista" },
    { label: "Casos", href: "/app/trabalhista/casos" },
    { label: "Novo" },
  ];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canCreate) return;
    setSaving(true);
    setError(null);
    const data = await createLaborCase(org.orgId, {
      clientId: clientId.trim(),
      legalMatterId: legalMatterId.trim(),
      clientRole,
      status,
      notes: notes.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setError(laborErrorMessage(data, "Não foi possível criar o caso."));
      setSaving(false);
      return;
    }
    router.push(`/app/trabalhista/casos/${data.laborCase.id}`);
  }

  if (org.ready && !canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para criar casos trabalhistas.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Novo caso trabalhista"
        description="Vincule cliente e matéria jurídica. FGTS e eSocial oficiais só existem com provedor configurado."
      />
      <SectionTabs
        label="Seções trabalhistas"
        items={TRABALHISTA_TABS}
        current="/app/trabalhista/casos"
      />
      <Alert tone="info" title="Cadastro interno">
        Não inventamos saldo oficial de FGTS nem vínculos eSocial sem provedor.
      </Alert>

      <form className="vj-card vj-stack" onSubmit={(event) => void onSubmit(event)}>
        <CalcLayerTag layer="FONTE" />
        <FormField id="lab-client" label="ID do cliente">
          <Input
            id="lab-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
            className="vj-technical"
          />
        </FormField>
        <FormField id="lab-matter" label="ID do caso jurídico">
          <Input
            id="lab-matter"
            value={legalMatterId}
            onChange={(e) => setLegalMatterId(e.target.value)}
            required
            className="vj-technical"
          />
        </FormField>
        <div className="vj-split">
          <FormField id="lab-role-new" label="Papel do cliente">
            <Select
              id="lab-role-new"
              value={clientRole}
              onChange={(e) => setClientRole(e.target.value)}
            >
              {Object.entries(LABOR_CLIENT_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="lab-status-new" label="Situação">
            <Select id="lab-status-new" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(LABOR_CASE_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <FormField id="lab-notes" label="Observações">
          <Textarea id="lab-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
        <button type="submit" className="vj-button vj-button-primary" disabled={saving}>
          {saving ? "Criando…" : "Criar caso"}
        </button>
      </form>
    </div>
  );
}
