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
import {
  apiErrorMessage,
  createDeadline,
  getActiveOrgId,
  isApiFailure,
} from "../../../../lib/productivity";

export default function NovoPrazoPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [baseDate, setBaseDate] = useState("");
  const [ruleType, setRuleType] = useState("business_days");
  const [ruleDays, setRuleDays] = useState("15");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const orgId = await getActiveOrgId();
    if (!orgId) {
      setError("Nenhuma organização ativa.");
      setPending(false);
      return;
    }
    const result = await createDeadline(orgId, {
      title,
      baseDate: new Date(baseDate).toISOString(),
      ruleType,
      ruleDays: Number(ruleDays),
      timezone: "America/Sao_Paulo",
      calculate: true,
    });
    if (isApiFailure(result)) {
      setError(apiErrorMessage(result, "Não foi possível criar o prazo."));
      setPending(false);
      return;
    }
    router.push(`/app/prazos/${result.deadline.id}`);
  }

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Prazos", href: "/app/prazos" },
          { label: "Novo" },
        ]}
      />
      <PageHeader
        title="Novo prazo"
        description="O cálculo gera status sugerido — confirme depois."
      />
      <Alert tone="info" title="Feriados">
        Calendário oficial de feriados: NOT_CONFIGURED. Dias úteis excluem sáb/dom; não trate como
        prazo jurídico definitivo.
      </Alert>
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      <form className="vj-stack" onSubmit={(e) => void onSubmit(e)}>
        <FormField id="title" label="Título">
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </FormField>
        <FormField id="base" label="Termo inicial">
          <Input
            id="base"
            type="datetime-local"
            value={baseDate}
            onChange={(e) => setBaseDate(e.target.value)}
            required
          />
        </FormField>
        <FormField id="rule" label="Regra">
          <Select id="rule" value={ruleType} onChange={(e) => setRuleType(e.target.value)}>
            <option value="calendar_days">Dias corridos</option>
            <option value="business_days">Dias úteis</option>
            <option value="manual_date">Data manual</option>
          </Select>
        </FormField>
        <FormField id="days" label="Dias">
          <Input
            id="days"
            type="number"
            min={0}
            value={ruleDays}
            onChange={(e) => setRuleDays(e.target.value)}
          />
        </FormField>
        <button type="submit" className="vj-button" disabled={pending}>
          {pending ? "Calculando…" : "Criar e calcular"}
        </button>
      </form>
    </div>
  );
}
