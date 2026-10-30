"use client";

import type { ReactNode } from "react";
import { AccessibilityPanel } from "./accessibility-panel";
import { InstitutionalFooter } from "./institutional-footer";
import { LiveAnnouncerProvider } from "./live-announcer";
import { LocaleProvider } from "./locale-provider";
import { OfflineBanner } from "./offline-banner";
import { PwaRegister } from "./pwa-register";
import { SessionLocaleBootstrap } from "./session-locale-bootstrap";
import { SkipLinks } from "./skip-links";
import { VerasJurisAssistant } from "./verasjuris-assistant";

export function PlatformChrome({
  children,
  userLocale,
  orgLocale,
  showFooter = true,
  includeSearchSkip = false,
}: {
  children: ReactNode;
  userLocale?: string | null;
  orgLocale?: string | null;
  showFooter?: boolean;
  includeSearchSkip?: boolean;
}) {
  return (
    <LocaleProvider userLocale={userLocale} orgLocale={orgLocale}>
      <LiveAnnouncerProvider>
        <SessionLocaleBootstrap />
        <SkipLinks includeSearch={includeSearchSkip} />
        <OfflineBanner />
        {children}
        {showFooter ? <InstitutionalFooter /> : null}
        <AccessibilityPanel />
        <VerasJurisAssistant />
        <PwaRegister />
      </LiveAnnouncerProvider>
    </LocaleProvider>
  );
}
