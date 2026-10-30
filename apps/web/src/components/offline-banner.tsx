"use client";

import { useEffect, useState } from "react";
import { useLocale } from "./locale-provider";
import { useAnnouncer } from "./live-announcer";

export function OfflineBanner() {
  const { t } = useLocale();
  const { announce } = useAnnouncer();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    function sync() {
      const next = typeof navigator !== "undefined" ? !navigator.onLine : false;
      setOffline((prev) => {
        if (prev !== next) {
          announce(next ? t("common.offline") : t("common.online"), next ? "assertive" : "polite");
        }
        return next;
      });
    }
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, [announce, t]);

  if (!offline) return null;
  return (
    <div className="vj-offline-banner" role="status" aria-live="assertive">
      {t("common.offline")}
    </div>
  );
}
