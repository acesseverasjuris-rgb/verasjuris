"use client";

import {
  Alert,
  Breadcrumb,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  Select,
} from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { CONTRATO_TABS } from "../../../../components/contracts-ui";
import {
  CONTRACT_STATUS_LABELS,
  createContract,
  hasContractPermission,
  isApiFailure,
  contractErrorMessage,
} from "../../../../lib/contracts";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function NovoContratoPage() {
  const org = useOrgContext();
  const router = useRouter();
  const canCreate = hasContractPermission(org.permissions, "create");

  const [title, setTitle] = useState("");
  const [contractType, setContractType] = useState("other");
  const [status, setStatus] = useState("draft");
  const [clientId, setClientId] = useState("");
  const [legalMatterId, setLegalMatterId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Contratos", href: "/app/contratos" },
    { label: "Novo" },
  ];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canCreate) return;
    setSaving(true);
    setError(null);
    const data = await createContract(org.orgId, {
      title: title.trim(),
      contractType,
      status,
      clientId: clientId.trim() || undefined,
      legalMatterId: legalMatterId.trim() || undefined,
    });
    if (isApiFailure(data)) {
      setError(contractErrorMessage(data, "Não foi possível criar o contrato."));
      setSaving(false);
      return;
    }
    router.push(`/app/contratos/${data.contract.id}`);
  }

  if (org.ready && !canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para criar contratos.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Novo contrato"
        description="Rascunho interno — assinatura eletrônica exige provedor configurado."
      />
      <SectionTabs
        label="Seções de contratos"
        items={CONTRATO_TABS}
        current="/app/contratos/novo"
      />
      <Alert tone="info" title="Assinatura">
        Não simulamos assinatura concluída. Use registro manual com documento de evidência quando
        necessário.
      </Alert>

      <form className="vj-card vj-stack" onSubmit={(event) => void onSubmit(event)}>
        <FormField id="ctr-title" label="Título">
          <Input id="ctr-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </FormField>
        <FormField id="ctr-type" label="Tipo">
          <Input
            id="ctr-type"
            value={contractType}
            onChange={(e) => setContractType(e.target.value)}
          />
        </FormField>
        <FormField id="ctr-status" label="Situação inicial">
          <Select id="ctr-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="ctr-client" label="ID do cliente (opcional)">
          <Input
            id="ctr-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="vj-technical"
          />
        </FormField>
        <FormField id="ctr-matter" label="ID do caso jurídico (opcional)">
          <Input
            id="ctr-matter"
            value={legalMatterId}
            onChange={(e) => setLegalMatterId(e.target.value)}
            className="vj-technical"
          />
        </FormField>
        {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
        <button type="submit" className="vj-button vj-button-primary" disabled={saving}>
          {saving ? "Criando…" : "Criar contrato"}
        </button>
      </form>
    </div>
  );
}
