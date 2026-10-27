"use client";

import { CSRF_HEADER } from "@verasjuris/security/constants";
import { Breadcrumb, Button, ButtonLink, FormField, Input, PageHeader } from "@verasjuris/ui";
import { useEffect, useState } from "react";
import type { ApiFailure } from "../../../lib/types";

type SessionRow = {
  id: string;
  current: boolean;
  createdAt: string;
  expiresAt: string;
  ipHint: string | null;
  userAgentHint: string | null;
};

export default function AccountPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [profile, setProfile] = useState({
    displayName: "",
    locale: "pt-BR",
    timeZone: "America/Sao_Paulo",
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [sessionsResponse, profileResponse] = await Promise.all([
        fetch("/api/v1/sessions", { cache: "no-store" }),
        fetch("/api/v1/account/profile", { cache: "no-store" }),
      ]);
      if (!sessionsResponse.ok) {
        if (!cancelled) setError("Não foi possível listar as sessões.");
      } else {
        const body = (await sessionsResponse.json()) as { sessions: SessionRow[] };
        if (!cancelled) setSessions(body.sessions);
      }
      if (profileResponse.ok) {
        const body = (await profileResponse.json()) as {
          profile: { displayName: string; locale: string; timeZone: string };
        };
        if (!cancelled) setProfile(body.profile);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadSessions() {
    const response = await fetch("/api/v1/sessions", { cache: "no-store" });
    if (!response.ok) {
      setError("Não foi possível listar as sessões.");
      return;
    }
    const body = (await response.json()) as { sessions: SessionRow[] };
    setSessions(body.sessions);
  }

  async function saveProfile(formData: FormData) {
    setPending(true);
    setProfileMessage(null);
    setError(null);
    const response = await fetch("/api/v1/account/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
      body: JSON.stringify({
        displayName: String(formData.get("displayName") ?? ""),
        locale: String(formData.get("locale") ?? "pt-BR"),
        timeZone: String(formData.get("timeZone") ?? "America/Sao_Paulo"),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as ApiFailure & {
      profile?: { displayName: string; locale: string; timeZone: string };
    };
    setPending(false);
    if (!response.ok) {
      setError(data.error?.message ?? "Não foi possível atualizar o perfil.");
      return;
    }
    if (data.profile) setProfile(data.profile);
    setProfileMessage("Perfil atualizado.");
  }

  async function changePassword(formData: FormData) {
    setPending(true);
    setPasswordMessage(null);
    setError(null);
    const response = await fetch("/api/v1/auth/password/change", {
      method: "POST",
      headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
      body: JSON.stringify({
        currentPassword: String(formData.get("currentPassword") ?? ""),
        newPassword: String(formData.get("newPassword") ?? ""),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as ApiFailure;
    setPending(false);
    if (!response.ok) {
      setError(data.error?.message ?? "Não foi possível alterar a senha.");
      return;
    }
    setPasswordMessage("Senha alterada. As outras sessões foram encerradas.");
    await reloadSessions();
  }

  async function revoke(sessionId: string) {
    setError(null);
    const response = await fetch(`/api/v1/sessions/${sessionId}`, {
      method: "DELETE",
      headers: { [CSRF_HEADER]: "1" },
    });
    if (!response.ok && response.status !== 204) {
      setError("Não foi possível encerrar a sessão.");
      return;
    }
    if (sessions.find((item) => item.id === sessionId)?.current) {
      window.location.assign("/entrar");
      return;
    }
    await reloadSessions();
  }

  async function revokeOthers() {
    setError(null);
    const response = await fetch("/api/v1/sessions/revoke-others", {
      method: "POST",
      headers: { [CSRF_HEADER]: "1" },
    });
    if (!response.ok) {
      setError("Não foi possível encerrar as outras sessões.");
      return;
    }
    await reloadSessions();
  }

  return (
    <div className="vj-stack">
      <Breadcrumb items={[{ label: "Painel", href: "/app" }, { label: "Conta" }]} />
      <PageHeader
        title="Conta"
        description="Altere a senha e gerencie as sessões ativas desta identidade."
      />
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      <section className="vj-card vj-stack">
        <h2 className="vj-section-title">Perfil</h2>
        {profileMessage ? <p role="status">{profileMessage}</p> : null}
        <form
          key={`${profile.displayName}|${profile.locale}|${profile.timeZone}`}
          className="vj-stack"
          action={saveProfile}
        >
          <FormField id="displayName" label="Nome de exibição">
            <Input
              id="displayName"
              name="displayName"
              defaultValue={profile.displayName}
              required
              minLength={2}
              maxLength={80}
            />
          </FormField>
          <FormField id="locale" label="Idioma">
            <Input id="locale" name="locale" defaultValue={profile.locale} required />
          </FormField>
          <FormField id="timeZone" label="Fuso horário">
            <Input id="timeZone" name="timeZone" defaultValue={profile.timeZone} required />
          </FormField>
          <Button type="submit" loading={pending} loadingLabel="Salvando">
            Salvar perfil
          </Button>
        </form>
      </section>
      <section className="vj-card vj-stack">
        <h2 className="vj-section-title">Perfis e vínculos</h2>
        <p>
          Configure perfis profissionais acumuláveis (advogado, parceiro, funcionário) e consulte a
          situação da verificação profissional.
        </p>
        <ButtonLink href="/app/perfis" variant="secondary">
          Gerenciar perfis
        </ButtonLink>
      </section>
      <section className="vj-card vj-stack">
        <h2 className="vj-section-title">Alterar senha</h2>
        {passwordMessage ? <p role="status">{passwordMessage}</p> : null}
        <form className="vj-stack" action={changePassword}>
          <FormField id="currentPassword" label="Senha atual">
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </FormField>
          <FormField id="newPassword" label="Nova senha" hint="Use pelo menos 12 caracteres.">
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
            />
          </FormField>
          <Button type="submit" loading={pending} loadingLabel="Salvando">
            Salvar nova senha
          </Button>
        </form>
      </section>
      <section className="vj-card vj-stack">
        <h2 className="vj-section-title">Sessões ativas</h2>
        <Button type="button" variant="secondary" onClick={() => void revokeOthers()}>
          Encerrar outras sessões
        </Button>
        {sessions.length === 0 ? (
          <p>Nenhuma sessão ativa encontrada.</p>
        ) : (
          <ul className="vj-stack">
            {sessions.map((session) => (
              <li key={session.id}>
                {session.current ? "Sessão atual" : "Outra sessão"} · criada em{" "}
                {new Date(session.createdAt).toLocaleString("pt-BR")}
                {session.ipHint ? ` · ${session.ipHint}` : ""}
                <div>
                  <Button type="button" variant="secondary" onClick={() => void revoke(session.id)}>
                    Encerrar
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
