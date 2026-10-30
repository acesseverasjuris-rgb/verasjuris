"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type AnnouncerContextValue = {
  announce: (message: string, politeness?: "polite" | "assertive") => void;
};

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

export function LiveAnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState("");
  const [assertive, setAssertive] = useState("");

  const announce = useCallback((message: string, politeness: "polite" | "assertive" = "polite") => {
    const stamp = `${message}`.trim();
    if (!stamp) return;
    if (politeness === "assertive") {
      setAssertive("");
      requestAnimationFrame(() => setAssertive(stamp));
    } else {
      setPolite("");
      requestAnimationFrame(() => setPolite(stamp));
    }
  }, []);

  const value = useMemo(() => ({ announce }), [announce]);

  return (
    <AnnouncerContext.Provider value={value}>
      {children}
      <div className="vj-visually-hidden" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="vj-visually-hidden" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnouncer(): AnnouncerContextValue {
  return useContext(AnnouncerContext) ?? { announce: () => undefined };
}
