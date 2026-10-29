"use client";

import { Breadcrumb, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CertificateStatusBadge } from "../../../../../components/education-ui";
import {
  educationErrorMessage,
  formatDateTime,
  isApiFailure,
  verifyCertificate,
  type CertificateVerifyResult,
} from "../../../../../lib/education";

export default function VerificarCertificadoPage() {
  const { code } = useParams<{ code: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CertificateVerifyResult | null>(null);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    void (async () => {
      const res = await verifyCertificate(decodeURIComponent(code));
      if (cancelled) return;
      if (isApiFailure(res)) {
        if (res.httpStatus === 404) setError("Certificado não encontrado para este código.");
        else setError(educationErrorMessage(res));
      } else setResult(res);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

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
        title="Verificação de certificado"
        description="Consulta pública. Este certificado não constitui assinatura ICP-Brasil."
      />
      {loading ? <LoadingState label="Verificando…" /> : null}
      {error ? <ErrorState title="Não verificado">{error}</ErrorState> : null}
      {result && !loading ? (
        <dl className="vj-stack">
          <div>
            <dt className="vj-meta">Válido</dt>
            <dd>{result.valid ? "Sim" : "Não"}</dd>
          </div>
          <div>
            <dt className="vj-meta">Situação</dt>
            <dd>
              <CertificateStatusBadge status={result.status} />
            </dd>
          </div>
          <div>
            <dt className="vj-meta">Titular</dt>
            <dd>{result.displayName ?? "—"}</dd>
          </div>
          <div>
            <dt className="vj-meta">Curso</dt>
            <dd>{result.courseTitle ?? "—"}</dd>
          </div>
          <div>
            <dt className="vj-meta">Número</dt>
            <dd>{result.certificateNumber ?? "—"}</dd>
          </div>
          <div>
            <dt className="vj-meta">Emitido em</dt>
            <dd>{result.issuedAt ? formatDateTime(result.issuedAt) : "—"}</dd>
          </div>
          {result.revokedAt ? (
            <div>
              <dt className="vj-meta">Revogado em</dt>
              <dd>{formatDateTime(result.revokedAt)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </div>
  );
}
