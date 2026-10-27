"use client";

import { CSRF_HEADER } from "@verasjuris/security/constants";
import { Button } from "@verasjuris/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type Preview = {
  email: string;
  roleKey: string;
  organizationName: string;
  expiresAt: string;
};

export function InviteForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Este convite está incompleto ou já expirou.");
      return;
    }
    void fetch(`/api/v1/invitations/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as {
          invitation?: Preview;
          error?: { message?: string };
        };
        if (!response.ok) {
          setError(data.error?.message ?? "Este convite não é válido ou já expirou.");
          return;
        }
        setPreview(data.invitation ?? null);
      })
      .catch(() => {
        setError("Não foi possível carregar o convite.");
      });
  }, [token]);

  async function accept() {
    setPending(true);
    setError(null);
    const response = await fetch(`/api/v1/invitations/${encodeURIComponent(token)}/accept`, {
      method: "POST",
      headers: { [CSRF_HEADER]: "1" },
    });
    const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    setPending(false);
    if (response.status === 401) {
      router.push(`/entrar?next=${encodeURIComponent(`/convite?token=${token}`)}`);
      return;
    }
    if (!response.ok) {
      setError(data.error?.message ?? "Não foi possível aceitar o convite.");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <div className="vj-stack">
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      {!error && !preview ? <p role="status">Carregando convite…</p> : null}
      {preview ? (
        <>
          <p>
            Você foi convidado para <strong>{preview.organizationName}</strong> como{" "}
            {preview.roleKey}.
          </p>
          <p>Convite destinado a {preview.email}.</p>
          <Button
            type="button"
            loading={pending}
            loadingLabel="Aceitando"
            onClick={() => void accept()}
          >
            Aceitar convite
          </Button>
        </>
      ) : null}
    </div>
  );
}
