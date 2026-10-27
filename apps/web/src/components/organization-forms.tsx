"use client";

import { CSRF_HEADER } from "@verasjuris/security/constants";
import { Button, FormField, Input, Select } from "@verasjuris/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiFailure } from "../lib/types";

async function send(path: string, method: "POST" | "PATCH", body: unknown) {
  const response = await fetch(path, {
    method,
    headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as ApiFailure & {
    organization?: { id: string };
  };
  return { response, data };
}

export function CreateOrganizationForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await send("/api/v1/organizations", "POST", {
      name: String(formData.get("name") ?? ""),
    });
    if (!result.response.ok || !result.data.organization) {
      setPending(false);
      setError(
        result.data.error?.message ?? "Não foi possível criar a organização. Nada foi salvo.",
      );
      return;
    }
    await fetch("/session/organizacao", {
      method: "POST",
      headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
      body: JSON.stringify({ organizationId: result.data.organization.id }),
    });
    router.push("/app");
    router.refresh();
  }

  return (
    <form className="vj-stack" action={onSubmit}>
      <FormField
        id="name"
        label="Nome da organização"
        hint="Este nome identifica o contexto de trabalho. Ele não cria um escritório, processo ou cadastro profissional."
      >
        <Input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          aria-describedby="name-hint"
        />
      </FormField>
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={pending} loadingLabel="Criando a organização">
        Criar organização
      </Button>
    </form>
  );
}

export function RenameOrganizationForm({
  organizationId,
  name,
}: {
  organizationId: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await send(`/api/v1/organizations/${organizationId}`, "PATCH", {
      name: String(formData.get("name") ?? ""),
    });
    setPending(false);
    if (!result.response.ok) {
      setError(
        result.data.error?.message ??
          "Não foi possível atualizar o nome. A versão anterior foi mantida.",
      );
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form className="vj-stack" action={onSubmit}>
      <FormField id="organization-name" label="Nome">
        <Input
          id="organization-name"
          name="name"
          defaultValue={name}
          required
          minLength={2}
          maxLength={120}
        />
      </FormField>
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      {saved ? <p role="status">Nome atualizado.</p> : null}
      <Button type="submit" loading={pending} loadingLabel="Salvando o nome">
        Salvar nome
      </Button>
    </form>
  );
}

export function AddMemberForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await send(`/api/v1/organizations/${organizationId}/members`, "POST", {
      email: String(formData.get("email") ?? ""),
    });
    setPending(false);
    if (!result.response.ok) {
      setError(
        result.data.error?.message ??
          "Não foi possível incluir a pessoa. Nenhuma participação foi criada.",
      );
      return;
    }
    router.refresh();
  }

  return (
    <form className="vj-stack" action={onSubmit}>
      <FormField
        id="member-email"
        label="E-mail da conta existente"
        hint="Inclui imediatamente quem já possui conta ativa. Para novos e-mails, use o convite."
      >
        <Input
          id="member-email"
          name="email"
          type="email"
          required
          aria-describedby="member-email-hint"
        />
      </FormField>
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={pending} loadingLabel="Incluindo participante">
        Incluir participante
      </Button>
    </form>
  );
}

export function InviteMemberForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/v1/organizations/${organizationId}/invitations`, {
      method: "POST",
      headers: { "content-type": "application/json", [CSRF_HEADER]: "1" },
      body: JSON.stringify({
        email: String(formData.get("email") ?? ""),
        roleKey: String(formData.get("roleKey") ?? "member"),
      }),
    });
    const data = (await response.json().catch(() => ({}))) as ApiFailure & {
      invitation?: { message?: string; emailDelivery?: string };
    };
    setPending(false);
    if (!response.ok) {
      setError(data.error?.message ?? "Não foi possível criar o convite. Nada foi enviado.");
      return;
    }
    setMessage(data.invitation?.message ?? "Convite registrado.");
    router.refresh();
  }

  return (
    <form className="vj-stack" action={onSubmit}>
      <FormField id="invite-email" label="E-mail do convite">
        <Input id="invite-email" name="email" type="email" required />
      </FormField>
      <FormField id="invite-role" label="Papel inicial">
        <Select name="roleKey" id="invite-role" defaultValue="member">
          <option value="member">Membro</option>
          <option value="administrator">Administrador</option>
        </Select>
      </FormField>
      {error ? (
        <p role="alert" className="vj-field-error">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      <Button type="submit" loading={pending} loadingLabel="Criando convite">
        Convidar
      </Button>
    </form>
  );
}

export function InvitationActions({
  organizationId,
  invitationId,
}: {
  organizationId: string;
  invitationId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<"resend" | "revoke" | null>(null);

  async function resend() {
    setPending("resend");
    setError(null);
    setMessage(null);
    const response = await fetch(
      `/api/v1/organizations/${organizationId}/invitations/${invitationId}/resend`,
      { method: "POST", headers: { [CSRF_HEADER]: "1" } },
    );
    const data = (await response.json().catch(() => ({}))) as ApiFailure & {
      invitation?: { message?: string };
    };
    setPending(null);
    if (!response.ok) {
      setError(data.error?.message ?? "Não foi possível reenviar o convite.");
      return;
    }
    setMessage(data.invitation?.message ?? "Convite atualizado.");
    router.refresh();
  }

  async function revoke() {
    setPending("revoke");
    setError(null);
    setMessage(null);
    const response = await fetch(
      `/api/v1/organizations/${organizationId}/invitations/${invitationId}`,
      { method: "DELETE", headers: { [CSRF_HEADER]: "1" } },
    );
    setPending(null);
    if (!response.ok && response.status !== 204) {
      const data = (await response.json().catch(() => ({}))) as ApiFailure;
      setError(data.error?.message ?? "Não foi possível revogar o convite.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="vj-inline-actions">
      <Button
        type="button"
        variant="secondary"
        loading={pending === "resend"}
        loadingLabel="Reenviando"
        onClick={() => void resend()}
      >
        Reenviar
      </Button>
      <Button
        type="button"
        variant="secondary"
        loading={pending === "revoke"}
        loadingLabel="Revogando"
        onClick={() => void revoke()}
      >
        Revogar
      </Button>
      {error ? (
        <span role="alert" className="vj-field-error">
          {error}
        </span>
      ) : null}
      {message ? <span role="status">{message}</span> : null}
    </div>
  );
}

export function ChangeRoleForm({
  organizationId,
  membershipId,
  role,
}: {
  organizationId: string;
  membershipId: string;
  role: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await send(
      `/api/v1/organizations/${organizationId}/members/${membershipId}`,
      "PATCH",
      {
        roleKeys: [String(formData.get("role") ?? "member")],
      },
    );
    setPending(false);
    if (!result.response.ok) {
      setError(
        result.data.error?.message ??
          "Não foi possível atualizar o papel. A versão anterior foi mantida.",
      );
      return;
    }
    router.refresh();
  }

  return (
    <form className="vj-inline-actions" action={onSubmit}>
      <Select name="role" aria-label="Papel" defaultValue={role}>
        <option value="member">Membro</option>
        <option value="administrator">Administrador</option>
        <option value="owner">Proprietário</option>
      </Select>
      <Button type="submit" variant="secondary" loading={pending} loadingLabel="Salvando papel">
        Salvar papel
      </Button>
      {error ? (
        <span role="alert" className="vj-field-error">
          {error}
        </span>
      ) : null}
    </form>
  );
}
