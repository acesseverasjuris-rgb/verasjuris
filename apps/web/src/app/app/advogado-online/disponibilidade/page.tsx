"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import { NoPermission, SectionTabs } from "../../../../components/ai-ui";
import {
  ADVOGADO_ONLINE_TABS,
  AvailabilitySlotsList,
  OnlineLawyerProvidersBanner,
} from "../../../../components/online-lawyer-ui";
import {
  createLawyerAvailabilitySlot,
  fetchLawyerAvailability,
  fetchOnlineLawyerProvidersStatus,
  hasOnlineLawyerPermission,
  isApiFailure,
  onlineLawyerErrorMessage,
  type LawyerAvailabilitySlot,
  type OnlineLawyerProvidersStatus,
} from "../../../../lib/online-lawyer";
import { fetchSessionAccount } from "../../../../lib/crm";
import { useOrgContext } from "../../../../lib/use-org-context";

export default function AdvogadoOnlineDisponibilidadePage() {
  const org = useOrgContext();
  const canManage = hasOnlineLawyerPermission(org.permissions, "availability.manage");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<OnlineLawyerProvidersStatus | null>(null);
  const [items, setItems] = useState<LawyerAvailabilitySlot[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("12:00");

  async function reload() {
    if (!org.orgId) return;
    const data = await fetchLawyerAvailability(org.orgId);
    if (!isApiFailure(data)) setItems(data.items);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload estável no mount do org
  useEffect(() => {
    if (!org.ready || !org.orgId || !canManage) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const account = await fetchSessionAccount();
      if (account) setUserId(account.user.id);
      const status = await fetchOnlineLawyerProvidersStatus(org.orgId!);
      if (!cancelled && !isApiFailure(status)) setProviders(status);
      await reload();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [org.ready, org.orgId, canManage]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!org.orgId || !userId) return;
    const result = await createLawyerAvailabilitySlot(org.orgId, {
      lawyerProfileId: userId,
      dayOfWeek: weekday,
      startTime,
      endTime,
    });
    if (isApiFailure(result)) {
      setError(onlineLawyerErrorMessage(result, "Não foi possível salvar disponibilidade."));
      return;
    }
    await reload();
  }

  const breadcrumb = [
    { label: "Painel", href: "/app" },
    { label: "Advogado Online", href: "/app/advogado-online" },
    { label: "Disponibilidade" },
  ];

  if (org.ready && !canManage) {
    return (
      <div className="vj-stack">
        <Breadcrumb items={breadcrumb} />
        <NoPermission>Você não tem permissão para gerenciar disponibilidade.</NoPermission>
      </div>
    );
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={breadcrumb} />
      <PageHeader title="Disponibilidade" description="Janelas semanais para match e consultas." />
      <SectionTabs
        label="Seções"
        items={ADVOGADO_ONLINE_TABS}
        current="/app/advogado-online/disponibilidade"
      />
      <OnlineLawyerProvidersBanner status={providers} />
      <form
        className="vj-stack vj-card"
        onSubmit={(e) => void handleAdd(e)}
        aria-label="Nova janela"
      >
        <h2 className="vj-section-title">Adicionar janela</h2>
        <label htmlFor="avail-weekday">Dia da semana (0=dom)</label>
        <input
          id="avail-weekday"
          className="vj-input"
          type="number"
          min={0}
          max={6}
          value={weekday}
          onChange={(e) => setWeekday(Number(e.target.value))}
        />
        <label htmlFor="avail-start">Início (HH:MM)</label>
        <input
          id="avail-start"
          className="vj-input"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
        />
        <label htmlFor="avail-end">Fim (HH:MM)</label>
        <input
          id="avail-end"
          className="vj-input"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          required
        />
        <button type="submit" className="vj-button vj-button-primary">
          Salvar
        </button>
      </form>
      {loading || !org.ready ? <LoadingState label="Carregando disponibilidade" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {!loading && items.length > 0 ? <AvailabilitySlotsList items={items} /> : null}
      {!loading && items.length === 0 ? (
        <EmptyState title="Sem janelas">Cadastre horários acima.</EmptyState>
      ) : null}
    </div>
  );
}
