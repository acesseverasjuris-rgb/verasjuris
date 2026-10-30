"use client";

import { useEffect } from "react";

/**
 * Registra SW apenas no cliente. O worker cacheia somente shell/assets públicos —
 * nunca respostas autenticadas de /api.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_ENABLE_SW !== "1") {
      return;
    }
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW opcional — falha silenciosa em ambientes sem HTTPS/localhost.
    });
  }, []);
  return null;
}
