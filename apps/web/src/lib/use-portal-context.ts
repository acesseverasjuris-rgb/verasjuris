"use client";

import { useEffect, useState } from "react";
import {
  fetchPortalMe,
  isApiFailure,
  isPortalAccessDenied,
  type ClientPortalContext,
  type PortalDashboard,
} from "./client-portal";
import { getActiveOrgId } from "./crm";

export type PortalContextState = {
  ready: boolean;
  orgId: string | null;
  linked: boolean;
  deniedMessage: string | null;
  context: ClientPortalContext | null;
  dashboard: PortalDashboard | null;
};

const initial: PortalContextState = {
  ready: false,
  orgId: null,
  linked: false,
  deniedMessage: null,
  context: null,
  dashboard: null,
};

/** Resolve organização ativa + vínculo de cliente via GET …/portal/me. */
export function usePortalContext(): PortalContextState {
  const [state, setState] = useState<PortalContextState>(initial);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const orgId = await getActiveOrgId();
      if (cancelled) return;
      if (!orgId) {
        setState({
          ready: true,
          orgId: null,
          linked: false,
          deniedMessage: "Selecione uma organização para acessar o portal do cliente.",
          context: null,
          dashboard: null,
        });
        return;
      }
      const me = await fetchPortalMe(orgId);
      if (cancelled) return;
      if (isApiFailure(me)) {
        setState({
          ready: true,
          orgId,
          linked: false,
          deniedMessage: isPortalAccessDenied(me)
            ? "Você não está vinculado como cliente desta organização. Peça ao escritório para liberar o acesso ao portal."
            : (me.error?.message ?? "Não foi possível carregar o portal."),
          context: null,
          dashboard: null,
        });
        return;
      }
      setState({
        ready: true,
        orgId,
        linked: true,
        deniedMessage: null,
        context: me.context,
        dashboard: me.dashboard,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
