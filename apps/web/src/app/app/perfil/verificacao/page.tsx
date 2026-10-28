"use client";

import { PageHeader } from "@verasjuris/ui";
import { VerificationDisclaimer } from "../../../../components/professional-verification-ui";

export default function PerfilVerificacaoPage() {
  return (
    <>
      <PageHeader title="Minha verificação" description="Envie documentos e acompanhe o status." />
      <VerificationDisclaimer />
    </>
  );
}
