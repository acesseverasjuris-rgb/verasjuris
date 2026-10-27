"use client";

import { useEffect, useState } from "react";
import { getActiveMembership, getActiveOrgId } from "./crm";

export type OrgContext = {
  ready: boolean;
  orgId: string | null;
  permissions: string[];
};

/** Carrega organização ativa e permissões do usuário (padrão das páginas de tarefas/documentos). */
export function useOrgContext(): OrgContext {
  const [state, setState] = useState<OrgContext>({ ready: false, orgId: null, permissions: [] });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [orgId, membership] = await Promise.all([getActiveOrgId(), getActiveMembership()]);
      if (cancelled) return;
      setState({ ready: true, orgId, permissions: membership?.permissions ?? [] });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
