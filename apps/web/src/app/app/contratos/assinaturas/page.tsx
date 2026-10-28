"use client";

import {
  Alert,
  Breadcrumb,
  ErrorState,
  FormField,
  Input,
  LoadingState,
  PageHeader,
} from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  CONTRATO_TABS,
  SignatureProviderBanner,
  SignatureRequestsList,
} from "../../../../components/contracts-ui";
import {
  contractErrorMessage,
  fetchContracts,
  fetchSignatureProvidersStatus,
  fetchSignatureRequests,
  hasContractPermission,
  isApiFailure,
  isSignatureProviderNotConfigured,
  recordManualSignature,
  type SignatureRequest,
} from "../../../../lib/contracts";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function ContratosAssinaturasPage() {
  const org = useOrgContext();
  const canRead = hasContractPermission(org.permissions, "read");
  const canRecord = hasContractPermission(org.permissions, "record_signature");

  const [notConfigured, setNotConfigured] = useState(true);
  const [providerKey, setProviderKey] = useState("NOT_CONFIGURED");
  const [requests, setRequests] = useState<SignatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [contractId, setContractId] = useState("");
  const [contractVersionId, setContractVersionId] = useState("");
  const [evidenceDocumentId, setEvidenceDocumentId] = useState("");
  const [signedAt, setSignedAt] = useState(() => new Date().toISOString());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!org.ready || !org.orgId || !canRead) {
      setLoading(false);
      return;
    }
    void (async () => {
      setLoading(true);
      const orgId = org.orgId!;
      const [provider, contracts] = await Promise.all([
        fetchSignatureProvidersStatus(orgId),
        fetchContracts(orgId, { status: "pending_signature", limit: 25 }),
      ]);
      if (!isApiFailure(provider)) {
        setNotConfigured(isSignatureProviderNotConfigured(provider));
        setProviderKey(provider.signature?.providerKey ?? "NOT_CONFIGURED");
      }
      if (isApiFailure(contracts)) {
        setError(contractErrorMessage(contracts, "Não foi possível carregar assinaturas."));
      } else {
        const groups = await Promise.all(
          contracts.items.map((c) => fetchSignatureRequests(orgId, c.id, { limit: 10 })),
        );
        const merged: SignatureRequest[] = [];
        for (const g of groups) if (!isApiFailure(g)) merged.push(...g.items);
        setRequests(merged);
      }
      setLoading(false);
    })();
  }, [org.ready, org.orgId, canRead]);

  async function onManualSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canRecord) return;
    setSaving(true);
    setFormError(null);
    setFormSuccess(null);
    const result = await recordManualSignature(org.orgId, contractId.trim(), {
      contractVersionId: contractVersionId.trim(),
      evidenceDocumentId: evidenceDocumentId.trim(),
      signedAt,
    });
    if (isApiFailure(result)) {
      setFormError(contractErrorMessage(result, "Não foi possível registrar a assinatura manual."));
    } else {
      setFormSuccess("Assinatura manual registrada com documento de evidência.");
    }
    setSaving(false);
  }

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Contratos", href: "/app/contratos" },
    { label: "Assinaturas" },
  ];

  if (org.ready && !canRead) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Sem permissão para assinaturas.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Assinaturas"
        description="Envio eletrônico só quando o provedor estiver configurado. Registro manual exige ID de documento de evidência."
      />
      <SectionTabs
        label="Seções de contratos"
        items={CONTRATO_TABS}
        current="/app/contratos/assinaturas"
      />
      <SignatureProviderBanner notConfigured={notConfigured} providerLabel={providerKey} />

      {notConfigured ? (
        <Alert tone="info" title="Sem envio automático">
          Não há botão de envio simulado. Configure o provedor ou use o formulário de assinatura
          manual abaixo.
        </Alert>
      ) : null}

      {loading ? <LoadingState label="Carregando solicitações" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && requests.length > 0 ? <SignatureRequestsList items={requests} /> : null}

      <section className="vj-card vj-stack" aria-labelledby="manual-sign-title">
        <h2 id="manual-sign-title" className="vj-section-title">
          Assinatura manual
        </h2>
        {!canRecord ? (
          <p className="vj-meta">Você não tem permissão contract.record_signature.</p>
        ) : (
          <form className="vj-stack" onSubmit={(event) => void onManualSubmit(event)}>
            <FormField id="ms-contract" label="ID do contrato">
              <Input
                id="ms-contract"
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                required
                className="vj-technical"
              />
            </FormField>
            <FormField id="ms-version" label="ID da versão do contrato">
              <Input
                id="ms-version"
                value={contractVersionId}
                onChange={(e) => setContractVersionId(e.target.value)}
                required
                className="vj-technical"
              />
            </FormField>
            <FormField id="ms-evidence" label="ID do documento de evidência">
              <Input
                id="ms-evidence"
                value={evidenceDocumentId}
                onChange={(e) => setEvidenceDocumentId(e.target.value)}
                required
                className="vj-technical"
              />
            </FormField>
            <FormField id="ms-signed-at" label="Assinado em (ISO 8601)">
              <Input
                id="ms-signed-at"
                value={signedAt}
                onChange={(e) => setSignedAt(e.target.value)}
                required
                className="vj-technical"
              />
            </FormField>
            {formError ? <ErrorState title="Erro">{formError}</ErrorState> : null}
            {formSuccess ? (
              <Alert tone="success" title="Registrado">
                {formSuccess}
              </Alert>
            ) : null}
            <button type="submit" className="vj-button vj-button-primary" disabled={saving}>
              {saving ? "Registrando…" : "Registrar assinatura manual"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
