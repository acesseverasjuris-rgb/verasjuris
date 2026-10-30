"use client";

import { Breadcrumb, EmptyState, ErrorState, LoadingState, PageHeader } from "@verasjuris/ui";
import { useCallback, useEffect, useState } from "react";
import type { AiApiFailure } from "../../../../lib/ai";
import {
  enableMeMfa,
  fetchMeDevices,
  fetchMeMfa,
  fetchMePasskeys,
  fetchMeSessions,
  isApiFailure,
  platformErrorMessage,
  revokeMeSession,
  revokeOtherMeSessions,
  verifyMeMfa,
  type DeviceRow,
  type MfaStatus,
  type PasskeyRow,
  type SecureSessionRow,
} from "../../../../lib/platform";

export default function SecuritySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [sessions, setSessions] = useState<SecureSessionRow[]>([]);
  const [otpauth, setOtpauth] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [mfaRes, passRes, deviceRes, sessionRes] = await Promise.all([
      fetchMeMfa(),
      fetchMePasskeys(),
      fetchMeDevices(),
      fetchMeSessions(),
    ]);
    if (!isApiFailure(mfaRes)) setMfa(mfaRes);
    else if (mfaRes.httpStatus !== 404) setError(platformErrorMessage(mfaRes));
    else setMfa({ status: "DISABLED", methods: [] });

    if (!isApiFailure(passRes)) setPasskeys(passRes.passkeys ?? []);
    else if (passRes.httpStatus === 404) setPasskeys([]);

    if (!isApiFailure(deviceRes)) setDevices(deviceRes.devices ?? []);
    else if (deviceRes.httpStatus === 404) setDevices([]);

    if (!isApiFailure(sessionRes)) setSessions(sessionRes.sessions ?? []);
    else if (sessionRes.httpStatus === 404) setSessions([]);

    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="vj-stack">
      <Breadcrumb
        items={[
          { label: "Painel", href: "/app" },
          { label: "Configurações" },
          { label: "Segurança" },
        ]}
      />
      <PageHeader
        title="Segurança da conta"
        description="MFA, passkeys, dispositivos e sessões. Recovery codes nunca em plaintext."
      />
      {loading ? <LoadingState label="Carregando segurança…" /> : null}
      {error ? <ErrorState title="Erro">{error}</ErrorState> : null}
      {message ? <p role="status">{message}</p> : null}

      {!loading ? (
        <>
          <section className="vj-card vj-stack">
            <h2 className="vj-section-title">MFA (TOTP)</h2>
            <p>
              Status: <strong>{mfa?.status ?? "DISABLED"}</strong>
            </p>
            <div className="vj-form-actions">
              <button
                type="button"
                className="vj-button"
                onClick={() => {
                  void (async () => {
                    const res = await enableMeMfa();
                    if (isApiFailure(res)) {
                      setMessage(
                        res.httpStatus === 404
                          ? "API MFA ainda não disponível. Use o fluxo quando o backend publicar /v1/me/security/mfa."
                          : platformErrorMessage(res),
                      );
                      return;
                    }
                    setOtpauth(res.otpauthUrl ?? null);
                    setMessage("Escaneie o segredo TOTP e confirme o código.");
                    await reload();
                  })();
                }}
              >
                Ativar MFA
              </button>
            </div>
            {otpauth ? (
              <p className="vj-technical">
                otpauth: <code>{otpauth}</code>
              </p>
            ) : null}
            <label>
              Código TOTP
              <input
                className="vj-input"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
            </label>
            <button
              type="button"
              className="vj-button vj-button-secondary"
              onClick={() => {
                void (async () => {
                  const res = await verifyMeMfa(code);
                  if (isApiFailure(res)) {
                    setMessage(platformErrorMessage(res));
                    return;
                  }
                  setMessage("MFA verificado.");
                  setCode("");
                  await reload();
                })();
              }}
            >
              Verificar código
            </button>
          </section>

          <section className="vj-card vj-stack">
            <h2 className="vj-section-title">Passkeys</h2>
            {passkeys.length === 0 ? (
              <EmptyState title="Nenhuma passkey">
                Registro WebAuthn quando /v1/me/security/passkeys estiver disponível. Nunca
                armazenamos chave privada.
              </EmptyState>
            ) : (
              <ul>
                {passkeys.map((item) => (
                  <li key={item.id}>
                    {item.name ?? item.id} · criado{" "}
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="vj-card vj-stack">
            <h2 className="vj-section-title">Dispositivos</h2>
            {devices.length === 0 ? (
              <EmptyState title="Nenhum dispositivo">
                Lista vazia ou API ainda não publicada.
              </EmptyState>
            ) : (
              <ul>
                {devices.map((item) => (
                  <li key={item.id}>
                    {item.deviceName ?? "Dispositivo"} — {item.browser ?? "?"} / {item.os ?? "?"}
                    {item.revokedAt ? " (revogado)" : ""}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="vj-card vj-stack">
            <h2 className="vj-section-title">Sessões</h2>
            <div className="vj-form-actions">
              <button
                type="button"
                className="vj-button vj-button-secondary"
                onClick={() => {
                  void (async () => {
                    const res = await revokeOtherMeSessions();
                    if (isApiFailure(res)) {
                      const failure = res as AiApiFailure;
                      if (failure.httpStatus !== 404) {
                        setMessage(platformErrorMessage(failure));
                        return;
                      }
                    }
                    setMessage("Demais sessões revogadas (quando API disponível).");
                    await reload();
                  })();
                }}
              >
                Revogar outras sessões
              </button>
            </div>
            {sessions.length === 0 ? (
              <EmptyState title="Sem sessões detalhadas">
                Fallback: gerencie sessões também em Conta, até a API /me/security/sessions.
              </EmptyState>
            ) : (
              <ul>
                {sessions.map((item) => (
                  <li key={item.id}>
                    {item.current ? "Atual · " : ""}
                    {item.userAgentHint ?? item.id}
                    {!item.current ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="vj-link-button"
                          onClick={() => {
                            void (async () => {
                              await revokeMeSession(item.id);
                              await reload();
                            })();
                          }}
                        >
                          Revogar
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="vj-meta">
              Ver também <a href="/app/conta">Conta</a> para sessões legadas.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
