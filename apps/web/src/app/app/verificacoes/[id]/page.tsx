"use client";

import { PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { VerificationDisclaimer } from "../../../../components/professional-verification-ui";

export default function VerificacaoDetalhePage() {
  const params = useParams<{ id: string }>();
  return (
    <>
      <PageHeader title={`Caso ${params.id}`} description="Detalhe de verificação profissional." />
      <VerificationDisclaimer />
    </>
  );
}
