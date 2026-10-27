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
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import { COMPARADOR_TABS } from "../../../../components/comparison-ui";
import { LayerTag } from "../../../../components/legal-review-ui";
import {
  LEGAL_COMPARISON_TYPE_LABELS,
  aiErrorMessage,
  createLegalComparison,
  hasLegalComparisonPermission,
  isApiFailure,
  type LegalComparisonSourceRole,
  type LegalComparisonType,
} from "../../../../lib/legal-comparisons";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function NovaComparacaoPage() {
  const org = useOrgContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const canCreate = hasLegalComparisonPermission(org.permissions, "create");

  const [title, setTitle] = useState("");
  const [comparisonType, setComparisonType] = useState<LegalComparisonType>("petition_vs_defense");
  const [legalMatterId, setLegalMatterId] = useState(searchParams.get("legalMatterId") ?? "");
  const [docA, setDocA] = useState("");
  const [docB, setDocB] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Comparador", href: "/app/comparador" },
    { label: "Nova" },
  ];

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !canCreate) return;
    if (!docA.trim() || !docB.trim()) {
      setError("Informe os IDs dos documentos dos lados A e B.");
      return;
    }
    setSaving(true);
    setError(null);
    const data = await createLegalComparison(org.orgId, {
      comparisonType,
      title: title.trim() || undefined,
      legalMatterId: legalMatterId.trim() || undefined,
      sources: [
        {
          documentId: docA.trim(),
          roleInComparison: "side_a" as LegalComparisonSourceRole,
          sortOrder: 0,
        },
        {
          documentId: docB.trim(),
          roleInComparison: "side_b" as LegalComparisonSourceRole,
          sortOrder: 1,
        },
      ],
      idempotencyKey: `cmp-create-${crypto.randomUUID()}`,
    });
    if (isApiFailure(data)) {
      setError(aiErrorMessage(data, "Não foi possível criar a comparação."));
      setSaving(false);
      return;
    }
    router.push(`/app/comparador/${data.comparison.id}`);
  }

  if (org.ready && !canCreate) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para criar comparações.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader
        title="Nova comparação"
        description="Selecione dois documentos. Depois execute a análise assistiva e revise cada achado."
      />
      <SectionTabs
        label="Seções do comparador"
        items={COMPARADOR_TABS}
        current="/app/comparador/novo"
      />

      <Alert tone="info" title="FONTE · Documentos">
        Informe os identificadores dos documentos já cadastrados na organização.
      </Alert>

      <form className="vj-card vj-stack" onSubmit={(event) => void onSubmit(event)}>
        <LayerTag layer="FONTE" />
        <FormField id="cmp-title" label="Título (opcional)">
          <Input id="cmp-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </FormField>
        <FormField id="cmp-type" label="Tipo de comparação">
          <Select
            id="cmp-type"
            value={comparisonType}
            onChange={(e) => setComparisonType(e.target.value as LegalComparisonType)}
          >
            {Object.entries(LEGAL_COMPARISON_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField id="cmp-matter" label="ID do caso (opcional)">
          <Input
            id="cmp-matter"
            value={legalMatterId}
            onChange={(e) => setLegalMatterId(e.target.value)}
            className="vj-technical"
          />
        </FormField>
        <div className="vj-split">
          <FormField id="cmp-doc-a" label="Documento lado A">
            <Input
              id="cmp-doc-a"
              value={docA}
              onChange={(e) => setDocA(e.target.value)}
              required
              className="vj-technical"
            />
          </FormField>
          <FormField id="cmp-doc-b" label="Documento lado B">
            <Input
              id="cmp-doc-b"
              value={docB}
              onChange={(e) => setDocB(e.target.value)}
              required
              className="vj-technical"
            />
          </FormField>
        </div>
        {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
        <button type="submit" className="vj-button vj-button-primary" disabled={saving}>
          {saving ? "Criando…" : "Criar comparação"}
        </button>
      </form>
    </div>
  );
}
