"use client";

import { Breadcrumb, Button, Input, PageHeader } from "@verasjuris/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") ?? "");

  return (
    <form
      className="vj-inline-actions"
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = code.trim();
        if (!trimmed) return;
        router.push(`/educacao/certificados/verificar/${encodeURIComponent(trimmed)}`);
      }}
    >
      <Input
        aria-label="Código de verificação"
        placeholder="Código do certificado"
        value={code}
        onChange={(ev) => setCode(ev.target.value)}
        required
      />
      <Button type="submit">Verificar</Button>
    </form>
  );
}

export default function VerificarCertificadoIndexPage() {
  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Educação", href: "/educacao" },
          { label: "Certificados", href: "/educacao/certificados" },
          { label: "Verificar" },
        ]}
      />
      <PageHeader
        title="Verificar certificado"
        description="Informe o código de verificação. Certificado ≠ assinatura ICP-Brasil."
      />
      <Suspense fallback={null}>
        <VerifyForm />
      </Suspense>
    </div>
  );
}
