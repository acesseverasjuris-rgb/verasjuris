"use client";

import { useEffect, useRef } from "react";
import { normalizeLocale } from "../lib/i18n";
import { useLocale } from "./locale-provider";

/** Quando autenticado, alinha locale do provider com o perfil (user → …). */
export function SessionLocaleBootstrap() {
  const { setLocale } = useLocale();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/v1/account/profile", { cache: "no-store" });
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as { profile?: { locale?: string } };
        const next = normalizeLocale(body.profile?.locale);
        if (next) await setLocale(next, { persist: false });
      } catch {
        // anônimo / API offline
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [setLocale]);

  return null;
}
