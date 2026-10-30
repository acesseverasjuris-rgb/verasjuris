"use client";

import { LanguageSwitcher, useLocale } from "./locale-provider";

type FooterLink = { href: string; labelKey: string };

const PRODUCT: FooterLink[] = [
  { href: "/planos", labelKey: "footer.plans" },
  { href: "/marketplace", labelKey: "footer.marketplace" },
  { href: "/educacao", labelKey: "footer.education" },
  { href: "/status", labelKey: "footer.status" },
];

const COMPANY: FooterLink[] = [
  { href: "/institucional/sobre", labelKey: "footer.about" },
  { href: "/institucional/contato", labelKey: "footer.contact" },
  { href: "/institucional/ajuda", labelKey: "footer.help" },
];

const LEGAL: FooterLink[] = [
  { href: "/politicas/termos", labelKey: "footer.terms" },
  { href: "/politicas/privacidade", labelKey: "footer.privacyPolicy" },
  { href: "/politicas/cookies", labelKey: "footer.cookies" },
  { href: "/politicas/uso-aceitavel", labelKey: "footer.aup" },
  { href: "/politicas/ia", labelKey: "footer.aiPolicy" },
  { href: "/politicas/marketplace", labelKey: "footer.marketplacePolicy" },
  { href: "/politicas/pagamentos", labelKey: "footer.paymentsPolicy" },
  { href: "/politicas/verificacao-profissional", labelKey: "footer.verificationPolicy" },
  { href: "/politicas/direitos-autorais", labelKey: "footer.copyrightPolicy" },
];

const SECURITY: FooterLink[] = [
  { href: "/politicas/seguranca", labelKey: "footer.securityPolicy" },
  { href: "/institucional/compliance", labelKey: "footer.whistleblowing" },
];

const PRIVACY: FooterLink[] = [
  { href: "/politicas/lgpd", labelKey: "footer.lgpd" },
  { href: "/institucional/preferencias-privacidade", labelKey: "footer.privacyPrefs" },
];

const A11Y: FooterLink[] = [
  { href: "/acessibilidade", labelKey: "footer.accessibility" },
  { href: "/acessibilidade/declaracao", labelKey: "a11y.statement" },
];

const DEVELOPERS: FooterLink[] = [{ href: "/developers", labelKey: "footer.api" }];

function Section({
  title,
  links,
  t,
}: {
  title: string;
  links: FooterLink[];
  t: (k: string) => string;
}) {
  return (
    <section>
      <h2 className="vj-footer-heading">{title}</h2>
      <ul className="vj-footer-list">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href}>{t(link.labelKey)}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InstitutionalFooter() {
  const { t } = useLocale();
  return (
    <footer className="vj-institutional-footer" role="contentinfo">
      <div className="vj-institutional-footer-grid">
        <Section title={t("footer.product")} links={PRODUCT} t={t} />
        <Section title={t("footer.company")} links={COMPANY} t={t} />
        <Section title={t("footer.legal")} links={LEGAL} t={t} />
        <Section title={t("footer.security")} links={SECURITY} t={t} />
        <Section title={t("footer.privacy")} links={PRIVACY} t={t} />
        <Section title={t("footer.accessibility")} links={A11Y} t={t} />
        <Section title={t("footer.developers")} links={DEVELOPERS} t={t} />
        <Section
          title={t("footer.support")}
          links={[{ href: "/institucional/ajuda", labelKey: "footer.help" }]}
          t={t}
        />
        <section>
          <h2 className="vj-footer-heading">{t("footer.languages")}</h2>
          <LanguageSwitcher />
        </section>
      </div>
      <p className="vj-meta">
        A Café Platine desenvolve a plataforma VerasJuris. O VerasJuris é independente de
        escritórios, autoridades e órgãos públicos. Políticas marcadas como {t("common.draft")} não
        têm aprovação jurídica final.
      </p>
    </footer>
  );
}
